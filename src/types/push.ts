export type ReminderFrequency = 'daily' | 'weekly' | 'off'

export interface PushPrefs {
  subscribed: boolean
  frequency: ReminderFrequency
  endpoint: string | null
}
