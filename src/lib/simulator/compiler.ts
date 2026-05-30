import type { Edge, Node } from '@xyflow/react'
import { isRuleLiveInNetwork } from '../rule-status'
import { getConditionKey } from './helpers'
import type {
  AlphaCompiledNode,
  BetaCompiledNode,
  CanonicalRuleSet,
  CompiledNetwork,
  CompiledNode,
  FlowNodeData,
  JoinCondition,
  ProductionCompiledNode,
  RootCompiledNode,
  Rule,
} from './types'

function createFlowNode(
  id: string,
  type: FlowNodeData['type'],
  label: string,
  subtitle: string,
  description: string,
  x: number,
  y: number,
  extra: Partial<FlowNodeData> = {},
): Node<FlowNodeData> {
  return {
    id,
    type: 'default',
    position: { x, y },
    data: {
      label,
      subtitle,
      type,
      description,
      ...extra,
    },
  }
}

function createEdge(source: string, target: string, label?: string): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    label,
    animated: false,
  }
}

function createRootNode(): RootCompiledNode {
  return {
    id: 'root',
    type: 'root',
    children: [],
  }
}

function createAlphaNode(id: string, organizationId: number, memoryKey: string, condition: Rule['conditions'][number]): AlphaCompiledNode {
  return {
    id,
    type: 'alpha',
    organizationId,
    memoryKey,
    condition,
    relatedRuleIds: [],
    signature: memoryKey,
    children: [],
  }
}

function createBetaNode(
  id: string,
  memoryKey: string,
  leftAlphaId: string,
  rightAlphaId: string,
  joinConditions: JoinCondition[],
): BetaCompiledNode {
  return {
    id,
    type: 'beta',
    memoryKey,
    leftAlphaId,
    rightAlphaId,
    joinConditions,
    relatedRuleIds: [],
    signature: memoryKey,
    children: [],
  }
}

function createProductionNode(rule: Rule): ProductionCompiledNode {
  return {
    id: rule.id,
    type: 'production',
    rule,
    relatedRuleIds: [rule.id],
    signature: rule.id,
    children: [],
  }
}

function getAlphaKey(rule: Rule, condition: Rule['conditions'][number]): string {
  return `org_${rule.organizationId}_${getConditionKey(condition)}`
}

function getBetaKey(rule: Rule, position: number, joinConditions: JoinCondition[]): string {
  return `org_${rule.organizationId}_rule_${rule.id}_pos_${position}_${joinConditions
    .map((condition) => `${condition.leftField}_${condition.operator}_${condition.rightField}`)
    .join('_')}`
}

export function compileNetwork(canonicalRuleSet: CanonicalRuleSet): CompiledNetwork {
  const nodes: Record<string, CompiledNode> = {}
  const root = createRootNode()
  nodes[root.id] = root

  const alphaIndex: Record<string, string> = {}
  const betaIndex: Record<string, string> = {}
  const productionIndex: Record<string, string> = {}
  const edges = new Map<string, Edge>()

  let alphaCounter = 0
  let betaCounter = 0

  const addChild = (parentId: string, childId: string, label?: string): void => {
    const parent = nodes[parentId]
    parent.children.push(childId)
    edges.set(`${parentId}->${childId}`, createEdge(parentId, childId, label))
  }

  const joinConditions: JoinCondition[] = [{ leftField: 'user_id', rightField: 'user_id', operator: '=' }]
  const registerRuleOnNode = (nodeId: string, ruleId: string): void => {
    const node = nodes[nodeId] as AlphaCompiledNode | BetaCompiledNode | ProductionCompiledNode | undefined
    if (!node || !('relatedRuleIds' in node)) return
    if (!node.relatedRuleIds.includes(ruleId)) node.relatedRuleIds.push(ruleId)
  }

  for (const rule of canonicalRuleSet.rules.filter((candidate) => isRuleLiveInNetwork(candidate.status))) {
    const production = createProductionNode(rule)
    nodes[production.id] = production
    productionIndex[rule.id] = production.id

    const sortedConditions = [...rule.conditions].sort(
      (left, right) => (left.position ?? 0) - (right.position ?? 0),
    )

    if (sortedConditions.length === 1) {
      const condition = sortedConditions[0]
      const alphaKey = getAlphaKey(rule, condition)
      if (!alphaIndex[alphaKey]) {
        const alphaId = `alpha-${++alphaCounter}`
        alphaIndex[alphaKey] = alphaId
        nodes[alphaId] = createAlphaNode(alphaId, rule.organizationId, alphaKey, condition)
      }
      registerRuleOnNode(alphaIndex[alphaKey], rule.id)

      addChild(root.id, alphaIndex[alphaKey], `org ${rule.organizationId}`)
      addChild(alphaIndex[alphaKey], production.id, rule.name)
      continue
    }

    const alphaIds = sortedConditions.map((condition) => {
      const alphaKey = getAlphaKey(rule, condition)
      if (!alphaIndex[alphaKey]) {
        const alphaId = `alpha-${++alphaCounter}`
        alphaIndex[alphaKey] = alphaId
        nodes[alphaId] = createAlphaNode(alphaId, rule.organizationId, alphaKey, condition)
      }
      registerRuleOnNode(alphaIndex[alphaKey], rule.id)
      addChild(root.id, alphaIndex[alphaKey], `org ${rule.organizationId}`)
      return alphaIndex[alphaKey]
    })

    if (rule.primaryOperator === 'OR') {
      alphaIds.forEach((alphaId) => addChild(alphaId, production.id, 'OR branch'))
      continue
    }

    let currentParentId: string | null = null
    for (let index = 0; index < alphaIds.length - 1; index += 1) {
      const leftId = index === 0 ? alphaIds[0] : currentParentId!
      const rightId = alphaIds[index + 1]
      const betaKey = getBetaKey(rule, index, joinConditions)

      if (!betaIndex[betaKey]) {
        const betaId = `beta-${++betaCounter}`
        betaIndex[betaKey] = betaId
        nodes[betaId] = createBetaNode(betaId, betaKey, leftId, rightId, joinConditions)
      }

      const betaId = betaIndex[betaKey]
      registerRuleOnNode(betaId, rule.id)
      if (index === 0) {
        addChild(alphaIds[0], betaId, 'left')
        addChild(alphaIds[1], betaId, 'right')
      } else {
        addChild(currentParentId!, betaId, 'left')
        addChild(rightId, betaId, 'right')
      }
      currentParentId = betaId
    }

    if (currentParentId) addChild(currentParentId, production.id, rule.name)
  }

  const flowNodes: Node<FlowNodeData>[] = []
  const rootNode = nodes[root.id]
  flowNodes.push(createFlowNode(rootNode.id, 'root', 'Root', 'Entry point', 'Dispatches facts to alpha nodes by organization', 40, 260))

  const alphaNodes = Object.values(nodes).filter((node): node is AlphaCompiledNode => node.type === 'alpha')
  alphaNodes.forEach((node, index) => {
    flowNodes.push(
      createFlowNode(
        node.id,
        'alpha',
        node.condition.field,
        `${node.condition.operator} ${String(node.condition.value)}`,
        `Shared alpha node for org ${node.organizationId}`,
        320,
        60 + index * 120,
        { condition: node.condition, relatedRuleIds: node.relatedRuleIds, signature: node.signature },
      ),
    )
  })

  const betaNodes = Object.values(nodes).filter((node): node is BetaCompiledNode => node.type === 'beta')
  betaNodes.forEach((node, index) => {
    flowNodes.push(
      createFlowNode(
        node.id,
        'beta',
        'Beta join',
        `${node.leftAlphaId} × ${node.rightAlphaId}`,
        'Rule-specific join node with same-transaction guard',
        650,
        140 + index * 150,
        { joinConditions: node.joinConditions, relatedRuleIds: node.relatedRuleIds, signature: node.signature },
      ),
    )
  })

  const productionNodes = Object.values(nodes).filter(
    (node): node is ProductionCompiledNode => node.type === 'production',
  )
  productionNodes.forEach((node, index) => {
    flowNodes.push(
      createFlowNode(
        node.id,
        'production',
        node.rule.name,
        `Production · ${node.rule.primaryOperator}`,
        'Emits activation facts and later drives final explanations',
        980,
        80 + index * 140,
        { ruleId: node.rule.id, relatedRuleIds: node.relatedRuleIds, signature: node.signature },
      ),
    )
  })

  return {
    nodes,
    rootId: root.id,
    alphaIndex,
    betaIndex,
    productionIndex,
    flowNodes,
    flowEdges: [...edges.values()],
    canonicalRuleSet,
  }
}
