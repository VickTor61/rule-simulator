import type { SimulationInput, TransactionFact, UserProfileFact } from './simulator/types'

export type CreateTransactionCounterpartyLike = {
  [key: string]: unknown
  name?: string
  account_number?: string
  country?: string
}

export type CreateTransactionDataLike = {
  [key: string]: unknown
  amount: number
  count?: number
  amount_sum?: number
  precision?: number
  currency: string
  transaction_authenticated?: boolean
  transaction_date?: string | null
  transaction_type: string
  description?: string
  country?: string
  ip_address?: string
  account_id?: string
  device_id?: string
  device_risk_score?: number
  trusted_device?: boolean
  channel: string
  metadata?: Record<string, unknown>
  counter_party?: CreateTransactionCounterpartyLike
  customer_reference_id: string
  transaction_reference: string
}

export type CreateTransactionRequestLike = {
  [key: string]: unknown
  organization_id?: number
  callback_url?: string | null
  user_profile?: Record<string, unknown>
  transaction: CreateTransactionDataLike
}

export type SavedFact = {
  id: string
  label: string
  organizationId: number
  request: CreateTransactionRequestLike
  transaction: SimulationInput['transaction']
  userProfile: UserProfileFact | null
  createdAt: string
}

function ensureObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message)
  }
  return value.trim()
}

function requirePositiveNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(message)
  }
  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function normalizeRequest(
  request: Record<string, unknown>,
  defaultOrganizationId: number,
): CreateTransactionRequestLike {
  const transaction = ensureObject(request.transaction, 'transaction object is required')
  const counterPartyInput = optionalObject(transaction.counter_party)
  const userProfileInput = optionalObject(request.user_profile)

  return {
    ...request,
    organization_id: optionalNumber(request.organization_id) ?? defaultOrganizationId,
    callback_url: optionalString(request.callback_url) ?? null,
    user_profile: userProfileInput,
    transaction: {
      ...transaction,
      amount: requirePositiveNumber(transaction.amount, 'amount must be positive'),
      count: optionalNumber(transaction.count),
      amount_sum: optionalNumber(transaction.amount_sum),
      precision: optionalNumber(transaction.precision),
      currency: requireString(transaction.currency, 'currency is required'),
      transaction_authenticated: optionalBoolean(transaction.transaction_authenticated),
      transaction_date: optionalString(transaction.transaction_date) ?? null,
      transaction_type: requireString(transaction.transaction_type, 'transaction_type is required'),
      description: optionalString(transaction.description),
      country: optionalString(transaction.country),
      ip_address: optionalString(transaction.ip_address),
      account_id: optionalString(transaction.account_id),
      device_id: optionalString(transaction.device_id),
      device_risk_score: optionalNumber(transaction.device_risk_score),
      trusted_device: optionalBoolean(transaction.trusted_device),
      channel: requireString(transaction.channel, 'channel is required'),
      metadata: optionalObject(transaction.metadata),
      counter_party: counterPartyInput
        ? {
            ...counterPartyInput,
            name: optionalString(counterPartyInput.name),
            account_number: optionalString(counterPartyInput.account_number),
            country: optionalString(counterPartyInput.country),
          }
        : undefined,
      customer_reference_id: requireString(
        transaction.customer_reference_id,
        'customer_reference_id is required',
      ),
      transaction_reference: requireString(
        transaction.transaction_reference,
        'transaction_reference is required',
      ),
    },
  }
}

function requestUserProfileToSimulationUserProfile(
  profile: Record<string, unknown> | undefined,
): UserProfileFact | null {
  if (!profile) return null

  return {
    transactionCount: optionalNumber(profile.transaction_count),
    overallRiskScore: optionalNumber(profile.overall_risk_score),
    avgTransactionAmount: optionalNumber(profile.avg_transaction_amount),
    maxTransactionAmount: optionalNumber(profile.max_transaction_amount),
    velocityScore: optionalNumber(profile.velocity_score),
    geographicScore: optionalNumber(profile.geographic_score),
    behavioralScore: optionalNumber(profile.behavioral_score),
    riskLevel: optionalString(profile.risk_level),
    kycStatus: optionalString(profile.kyc_status),
    isVerified: optionalBoolean(profile.is_verified),
  }
}

function simulationUserProfileToRequestUserProfile(
  userProfile: UserProfileFact | null | undefined,
): Record<string, unknown> | undefined {
  if (!userProfile) return undefined

  return {
    transaction_count: userProfile.transactionCount,
    overall_risk_score: userProfile.overallRiskScore,
    avg_transaction_amount: userProfile.avgTransactionAmount,
    max_transaction_amount: userProfile.maxTransactionAmount,
    velocity_score: userProfile.velocityScore,
    geographic_score: userProfile.geographicScore,
    behavioral_score: userProfile.behavioralScore,
    risk_level: userProfile.riskLevel,
    kyc_status: userProfile.kycStatus,
    is_verified: userProfile.isVerified,
  }
}

export function factRequestToSimulationTransaction(
  request: CreateTransactionRequestLike,
  defaultOrganizationId = 1,
): TransactionFact {
  const organizationId = request.organization_id ?? defaultOrganizationId
  const transactionDate = request.transaction.transaction_date ?? undefined
  const transactionReference = request.transaction.transaction_reference
  const customerReferenceId = request.transaction.customer_reference_id

  return {
    id: transactionReference,
    organizationId,
    userId: customerReferenceId,
    amount: request.transaction.amount,
    count: request.transaction.count,
    amountSum: request.transaction.amount_sum,
    precision: request.transaction.precision,
    currency: request.transaction.currency,
    country: request.transaction.country,
    transactionType: request.transaction.transaction_type,
    channel: request.transaction.channel,
    accountId: request.transaction.account_id,
    customerReferenceId,
    externalId: transactionReference,
    reference: transactionReference,
    description: request.transaction.description,
    ipAddress: request.transaction.ip_address,
    deviceId: request.transaction.device_id,
    transactionAuthenticated: request.transaction.transaction_authenticated,
    deviceRiskScore: request.transaction.device_risk_score,
    trustedDevice: request.transaction.trusted_device,
    counterpartyName: request.transaction.counter_party?.name,
    counterpartyAccountNumber: request.transaction.counter_party?.account_number,
    counterpartyCountry: request.transaction.counter_party?.country,
    metadata: request.transaction.metadata,
    createdAt: transactionDate ?? new Date().toISOString(),
    transactionDate,
    status: 'pending',
  }
}

export function simulationTransactionToFactRequest(transaction: TransactionFact): CreateTransactionRequestLike {
  return {
    organization_id: transaction.organizationId,
    transaction: {
      amount: transaction.amount ?? 0,
      count: transaction.count,
      amount_sum: transaction.amountSum,
      precision: transaction.precision,
      currency: transaction.currency ?? '',
      transaction_authenticated: transaction.transactionAuthenticated,
      transaction_date: transaction.transactionDate ?? transaction.createdAt ?? null,
      transaction_type: transaction.transactionType ?? '',
      description: transaction.description,
      country: transaction.country,
      ip_address: transaction.ipAddress,
      account_id: transaction.accountId,
      device_id: transaction.deviceId,
      device_risk_score: transaction.deviceRiskScore,
      trusted_device: transaction.trustedDevice,
      channel: transaction.channel ?? '',
      metadata: transaction.metadata,
      counter_party: transaction.counterpartyName || transaction.counterpartyAccountNumber || transaction.counterpartyCountry
        ? {
            name: transaction.counterpartyName,
            account_number: transaction.counterpartyAccountNumber,
            country: transaction.counterpartyCountry,
          }
        : undefined,
      customer_reference_id: transaction.customerReferenceId ?? transaction.userId,
      transaction_reference: transaction.externalId ?? transaction.reference ?? transaction.id,
    },
  }
}

export function buildSavedFactFromTransaction(
  transaction: TransactionFact,
  id: string,
  userProfile: UserProfileFact | null = null,
): SavedFact {
  const request = simulationTransactionToFactRequest(transaction)
  const requestUserProfile = simulationUserProfileToRequestUserProfile(userProfile)
  if (requestUserProfile) {
    request.user_profile = requestUserProfile
  }
  const label = request.transaction.transaction_reference || `${request.transaction.customer_reference_id} · ${request.transaction.amount}`

  return {
    id,
    label,
    organizationId: transaction.organizationId,
    request,
    transaction,
    userProfile,
    createdAt: new Date().toISOString(),
  }
}

export function parseFactRequest(
  input: string,
  defaultOrganizationId: number,
  existingFact?: SavedFact | null,
): SavedFact {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid fact JSON')
  }

  const request = normalizeRequest(
    ensureObject(parsed, 'Paste a single transaction request object.'),
    defaultOrganizationId,
  )

  const transaction = factRequestToSimulationTransaction(request, defaultOrganizationId)
  const userProfile = requestUserProfileToSimulationUserProfile(request.user_profile)
  const label = request.transaction.transaction_reference || `${request.transaction.customer_reference_id} · ${request.transaction.amount}`

  return {
    id: existingFact?.id ?? `fact-${transaction.id}-${Date.now()}`,
    label,
    organizationId: transaction.organizationId,
    request,
    transaction,
    userProfile,
    createdAt: existingFact?.createdAt ?? new Date().toISOString(),
  }
}
