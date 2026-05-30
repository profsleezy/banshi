export type AccessPlanKey = 'request' | 'starter' | 'agency' | 'command' | 'founder'
export type AccessStatusValue = 'pending' | 'trial' | 'active' | 'comped' | 'suspended' | 'canceled'

export type AccessPlan = {
  key: AccessPlanKey
  name: string
  price: string
  clientLimit: number
  description: string
  features: string[]
  highlighted?: boolean
}

export type UserAccessStatus = {
  active: boolean
  status: AccessStatusValue | 'missing'
  plan: AccessPlanKey
  planName: string
  clientLimit: number
  clientCount: number
  remainingClients: number
  features: Record<string, any>
  expiresAt: string | null
  reason?: string
}

export const accessPlans: AccessPlan[] = [
  {
    key: 'starter',
    name: 'Starter Watch',
    price: '$29/mo',
    clientLimit: 5,
    description: 'For one operator protecting a small creator or local agency roster.',
    features: ['5 monitored clients', 'Extension snapshots', 'Risk dashboard', 'Webhook alerts', 'CSV exports'],
  },
  {
    key: 'agency',
    name: 'Agency Desk',
    price: '$79/mo',
    clientLimit: 25,
    description: 'For agencies that need a daily operating queue and audit trail.',
    features: ['25 monitored clients', 'Client reports', 'Investigation log', 'PDF/CSV reports', 'Setup help included'],
    highlighted: true,
  },
  {
    key: 'command',
    name: 'Command Room',
    price: '$149/mo',
    clientLimit: 75,
    description: 'For ops teams watching high-value accounts and escalation workflows.',
    features: ['75 monitored clients', 'Priority setup help', 'Incident severity model', 'Webhook automations', 'Readiness scoring'],
  },
  {
    key: 'founder',
    name: 'Custom Desk',
    price: 'Custom',
    clientLimit: 150,
    description: 'For larger rosters or teams that need a custom setup path.',
    features: ['Custom client limit', 'Setup call', 'Custom workflow notes', 'Direct support channel', 'Priority feature requests'],
  },
]

export function getPlan(key?: string | null) {
  return accessPlans.find((plan) => plan.key === key) ?? accessPlans[0]
}
