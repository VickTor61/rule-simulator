import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { ImportPanel } from '../components/ImportPanel'
import { useSimulatorStore } from '../lib/store'

describe('ImportPanel JSON formatting', () => {
  beforeEach(() => {
    useSimulatorStore.setState({
      workspaceMode: 'simulator',
      rulesText: '{"rules":[{"name":"Test","organization_id":1,"primary_operator":"AND","conditions":[{"field":"amount","operator":">","value":10}],"actions":[{"type":"review","decision":"review"}]}]}',
      baselineRulesText: '{"rules":[]}',
      candidateRulesText: '{"rules":[]}',
      transactionText: '{"id":"txn-1","organizationId":1,"userId":"user-1"}',
      userProfileText: '{}',
      analysisText: '{}',
      error: null,
    })
  })

  test('formats rules json in place', async () => {
    const user = userEvent.setup()
    render(<ImportPanel />)

    const rulesEditor = screen.getByLabelText('Rules JSON') as HTMLTextAreaElement
    expect(rulesEditor.value).toContain('{"rules":')

    const formatButtons = screen.getAllByRole('button', { name: /format/i })
    await user.click(formatButtons[0])

    expect(rulesEditor.value).toContain('\n  "rules": [\n')
  })

  test('switches into diff mode and shows baseline and candidate editors', async () => {
    const user = userEvent.setup()
    render(<ImportPanel />)

    await user.click(screen.getByRole('tab', { name: /diff/i }))

    expect(screen.getByLabelText('Baseline Rules JSON')).toBeInTheDocument()
    expect(screen.getByLabelText('Candidate Rules JSON')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
  })
})
