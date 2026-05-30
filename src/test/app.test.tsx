import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { parseFactRequest } from '../lib/facts'
import { useSimulatorStore } from '../lib/store'

describe('App', () => {
  test('renders the simulator display-only layout with the rules engine graph', async () => {
    const user = userEvent.setup()

    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    render(<App />)

    expect(screen.getByText(/Rules Engine Network Simulator/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Rules engine simulator/i).length).toBeGreaterThan(0)
    expect(await screen.findByLabelText(/Rules engine graph/i)).toBeInTheDocument()
    expect(screen.queryByText(/Tree Graph Demo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Import and presets/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Node and replay details/i)).not.toBeInTheDocument()

    const graph = await screen.findByLabelText(/Rules engine graph/i)
    const rootNode = within(graph).getByRole('button', { name: /select root node/i })

    await user.click(rootNode)
    expect(screen.getByText(/Engine replay timeline/i)).toBeInTheDocument()
    expect(screen.queryByText(/Step and node explanation/i)).not.toBeInTheDocument()

    rootNode.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument()
  })

  test('opens explanation in its own workspace from the sidebar', async () => {
    const user = userEvent.setup()

    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Explanation$/i }))

    expect(await screen.findByText(/Step and node explanation/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Rules engine graph/i)).not.toBeInTheDocument()
  })

  test('allows hiding and restoring the mission overlay on the canvas', async () => {
    const user = userEvent.setup()

    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    render(<App />)

    expect(screen.queryByText(/Current event/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Play$/i }))
    expect(await screen.findByText(/Current event/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Hide mission overlay/i }))

    expect(screen.queryByText(/Current event/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show mission overlay/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Show mission overlay/i }))

    expect(screen.getByText(/Current event/i)).toBeInTheDocument()
  })

  test('opens the guided rule builder modal without crashing', async () => {
    const user = userEvent.setup()

    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Rulesets$/i }))
    await screen.findByText(/Rule network sources/i)
    await user.click(screen.getByRole('button', { name: /Guided rule builder/i }))

    expect(screen.getByRole('heading', { name: /Guided rule builder/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Rule name/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Description/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Builder$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^JSON$/i })).toBeInTheDocument()
    expect(screen.getByText(/Network impact preview/i)).toBeInTheDocument()
  })

  test('opens the add fact modal and shows the API-shaped fact editor', async () => {
    const user = userEvent.setup()

    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Facts$/i }))
    await screen.findByText(/Transaction fact library/i)
    await user.click(screen.getByRole('button', { name: /Add fact/i }))

    expect(screen.getByRole('heading', { name: /Add fact/i })).toBeInTheDocument()
    const factEditor = screen.getByLabelText(/Fact JSON editor/i) as HTMLTextAreaElement
    expect(factEditor).toBeInTheDocument()
    expect(factEditor.value).toContain('"transaction_reference": ""')
    expect(factEditor.value).toContain('"customer_reference_id": ""')
  })

  test('opens the fact modal in edit mode for the selected fact', async () => {
    const user = userEvent.setup()

    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Facts$/i }))
    await screen.findByText(/Transaction fact library/i)
    await user.click(screen.getByRole('button', { name: /Edit EXT-001/i }))

    expect(screen.getByRole('heading', { name: /Edit fact/i })).toBeInTheDocument()
    const factEditor = screen.getByLabelText(/Fact JSON editor/i) as HTMLTextAreaElement
    expect(factEditor.value).toContain('EXT-001')
  })

  test('renders the fact comparison workspace for multiple saved facts', async () => {
    const user = userEvent.setup()

    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('engine-fidelity')
      state.resetTraversal()
      state.setActiveRuleId(null)
      state.saveFact(parseFactRequest(
        JSON.stringify({
          transaction: {
            transaction_reference: 'TX-COMPARE-2',
            customer_reference_id: 'compare-user-2',
            amount: 200,
            currency: 'NGN',
            transaction_type: 'withdrawal',
            channel: 'mobile',
          },
        }),
        42,
      ))
    })

    render(<App />)

    await user.click(screen.getByRole('tab', { name: /Fact compare/i }))

    expect(screen.getByText(/Compare facts/i)).toBeInTheDocument()
    expect(screen.getAllByText(/TX-COMPARE-2/i).length).toBeGreaterThan(0)
  })

  test('marks production as triggered after a successful fact run', async () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('single-condition')
      state.runSimulation()
      const latestRun = useSimulatorStore.getState().run
      state.setStepIndex((latestRun?.timeline.length ?? 1) - 1)
    })

    render(<App />)

    expect(await screen.findByTestId('tree-node-rule-single')).toHaveAttribute('data-node-state', 'triggered')
  })

  test('shows dead-end execution when a fact fails the alpha condition', async () => {
    act(() => {
      const state = useSimulatorStore.getState()
      state.setWorkspaceMode('simulator')
      state.loadPreset('single-condition')
      const lowAmountFact = parseFactRequest(
        JSON.stringify({
          transaction: {
            transaction_reference: 'TX-LOW-1',
            customer_reference_id: 'user-123',
            amount: 50,
            currency: 'NGN',
            transaction_type: 'withdrawal',
            channel: 'mobile',
          },
        }),
        42,
      )
      state.saveFact(lowAmountFact)
      state.runSelectedFact()
      const latestRun = useSimulatorStore.getState().run
      state.setStepIndex((latestRun?.timeline.length ?? 1) - 1)
    })

    render(<App />)

    expect(await screen.findByTestId('tree-node-alpha-1')).toHaveAttribute('data-node-state', 'failed')
    expect(screen.getByTestId('tree-node-rule-single')).toHaveAttribute('data-node-state', 'unreached')
  })
})
