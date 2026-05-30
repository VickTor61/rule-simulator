import type { CanonicalRuleSet } from '../lib/simulator/types'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface AuthoredRuleViewProps {
  ruleSet: CanonicalRuleSet | null
}

export function AuthoredRuleView({ ruleSet }: AuthoredRuleViewProps): JSX.Element {
  if (!ruleSet) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground">
        Compile the input to inspect the authored rule structure.
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {ruleSet.rules.map((rule) => (
        <Card key={rule.id}>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{rule.name}</CardTitle>
              <Badge variant="outline">{rule.category ?? 'transaction'}</Badge>
              <Badge variant="secondary">Primary {rule.primaryOperator}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(rule.conditionGroups ?? []).length > 0 ? (
              <div className="grid gap-2">
                {rule.conditionGroups?.map((group) => (
                  <div key={`${rule.id}-${group.position}`} className="rounded-md border border-border bg-muted/50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline">Group {group.position}</Badge>
                      <Badge variant="secondary">{group.operator}</Badge>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {group.conditions.map((condition) => (
                        <li key={`${condition.field}-${condition.position}`}>
                          <code>{condition.field}</code> {condition.operator} <code>{String(condition.value)}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {rule.conditions.map((condition) => (
                  <li key={`${condition.field}-${condition.position}`}>
                    <code>{condition.field}</code> {condition.operator} <code>{String(condition.value)}</code>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              {rule.actions.map((action, index) => (
                <Badge key={`${action.type}-${index}`} variant="outline">
                  {action.type}:{action.decision}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
