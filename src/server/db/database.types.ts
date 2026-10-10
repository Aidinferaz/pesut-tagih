
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"details": NonNullable<Json>,"entity_id": string | null,"group_id": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"group_id": string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"group_id"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_fkey"
      columns: ["actor"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage": {
                  Row: {
                    "chats": number,"day": string,"scans": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chats"?: number,"day"?: string,"scans"?: number,"user_id": string
                  }
                  Update: {
                    "chats"?: number,"day"?: string,"scans"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"allowed_emails": {
                  Row: {
                    "email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string
                  }
                  Update: {
                    "email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contact_channels": {
                  Row: {
                    "notify_push": boolean,"notify_telegram": boolean,"notify_whatsapp": boolean,"telegram_chat_id": number | null,"updated_at": string,"user_id": string,"wa_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "notify_push"?: boolean,"notify_telegram"?: boolean,"notify_whatsapp"?: boolean,"telegram_chat_id"?: number | null,"updated_at"?: string,"user_id": string,"wa_number"?: string | null
                  }
                  Update: {
                    "notify_push"?: boolean,"notify_telegram"?: boolean,"notify_whatsapp"?: boolean,"telegram_chat_id"?: number | null,"updated_at"?: string,"user_id"?: string,"wa_number"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_channels_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_items": {
                  Row: {
                    "amount": number,"expense_id": string,"id": string,"name": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"expense_id": string,"id"?: string,"name": string,"position": number
                  }
                  Update: {
                    "amount"?: number,"expense_id"?: string,"id"?: string,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_items_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_shares": {
                  Row: {
                    "amount": number,"expense_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"expense_id": string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"expense_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_shares_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_shares_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "created_at": string,"created_by": string,"deleted_at": string | null,"discount": number,"group_id": string,"id": string,"note": string | null,"number": number,"occurred_on": string,"paid_by": string,"receipt_path": string | null,"recurring_bill_id": string | null,"service": number,"split_method": string,"tax": number,"title": string,"total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"deleted_at"?: string | null,"discount"?: number,"group_id": string,"id"?: string,"note"?: string | null,"number": number,"occurred_on"?: string,"paid_by": string,"receipt_path"?: string | null,"recurring_bill_id"?: string | null,"service"?: number,"split_method": string,"tax"?: number,"title": string,"total": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"discount"?: number,"group_id"?: string,"id"?: string,"note"?: string | null,"number"?: number,"occurred_on"?: string,"paid_by"?: string,"receipt_path"?: string | null,"recurring_bill_id"?: string | null,"service"?: number,"split_method"?: string,"tax"?: number,"title"?: string,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_recurring_bill_id_fkey"
      columns: ["recurring_bill_id"]
isOneToOne: false
      referencedRelation: "recurring_bills"
      referencedColumns: ["id"]
    }
                  ]
                },"group_invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"group_id": string,"id": string,"max_uses": number,"revoked_at": string | null,"token_hash": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"expires_at": string,"group_id": string,"id"?: string,"max_uses": number,"revoked_at"?: string | null,"token_hash": string,"uses"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"group_id"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"token_hash"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_invites_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"joined_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "auto_confirm_days": number,"created_at": string,"created_by": string,"hull": string,"id": string,"name": string,"next_number": number,"reminder_after_days": (number)[],"reminder_repeat_days": number,"simplify_debts": boolean,"telegram_chat_id": number | null,"telegram_recap_amounts": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_confirm_days"?: number,"created_at"?: string,"created_by": string,"hull"?: string,"id"?: string,"name": string,"next_number"?: number,"reminder_after_days"?: (number)[],"reminder_repeat_days"?: number,"simplify_debts"?: boolean,"telegram_chat_id"?: number | null,"telegram_recap_amounts"?: boolean
                  }
                  Update: {
                    "auto_confirm_days"?: number,"created_at"?: string,"created_by"?: string,"hull"?: string,"id"?: string,"name"?: string,"next_number"?: number,"reminder_after_days"?: (number)[],"reminder_repeat_days"?: number,"simplify_debts"?: boolean,"telegram_chat_id"?: number | null,"telegram_recap_amounts"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"item_claims": {
                  Row: {
                    "item_id": string,"user_id": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "item_id": string,"user_id": string,"weight"?: number
                  }
                  Update: {
                    "item_id"?: string,"user_id"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_claims_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "expense_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_claims_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_log": {
                  Row: {
                    "channel": string,"dedupe_key": string,"error": string | null,"group_id": string | null,"id": number,"kind": string,"ok": boolean,"sent_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"dedupe_key": string,"error"?: string | null,"group_id"?: string | null,"id"?: never,"kind": string,"ok": boolean,"sent_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "channel"?: string,"dedupe_key"?: string,"error"?: string | null,"group_id"?: string | null,"id"?: never,"kind"?: string,"ok"?: boolean,"sent_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_log_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "account_name": string,"account_number": string,"created_at": string,"id": string,"priority": number,"provider": string,"qris_path": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name": string,"account_number": string,"created_at"?: string,"id"?: string,"priority"?: number,"provider": string,"qris_path"?: string | null,"user_id": string
                  }
                  Update: {
                    "account_name"?: string,"account_number"?: string,"created_at"?: string,"id"?: string,"priority"?: number,"provider"?: string,"qris_path"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_methods_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"locale": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id": string,"locale"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recurring_bills": {
                  Row: {
                    "active": boolean,"amount": number,"created_at": string,"created_by": string,"day_of_month": number,"group_id": string,"id": string,"next_run_on": string,"paid_by": string,"participants": (string)[],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount": number,"created_at"?: string,"created_by": string,"day_of_month": number,"group_id": string,"id"?: string,"next_run_on": string,"paid_by": string,"participants": (string)[],"title": string
                  }
                  Update: {
                    "active"?: boolean,"amount"?: number,"created_at"?: string,"created_by"?: string,"day_of_month"?: number,"group_id"?: string,"id"?: string,"next_run_on"?: string,"paid_by"?: string,"participants"?: (string)[],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_bills_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_bills_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_bills_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"settlements": {
                  Row: {
                    "amount": number,"auto_confirmed": boolean,"created_at": string,"decided_at": string | null,"from_user": string,"group_id": string,"id": string,"note": string | null,"number": number,"proof_path": string | null,"provider": string | null,"rejected_reason": string | null,"status": string,"to_user": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"auto_confirmed"?: boolean,"created_at"?: string,"decided_at"?: string | null,"from_user": string,"group_id": string,"id"?: string,"note"?: string | null,"number": number,"proof_path"?: string | null,"provider"?: string | null,"rejected_reason"?: string | null,"status"?: string,"to_user": string
                  }
                  Update: {
                    "amount"?: number,"auto_confirmed"?: boolean,"created_at"?: string,"decided_at"?: string | null,"from_user"?: string,"group_id"?: string,"id"?: string,"note"?: string | null,"number"?: number,"proof_path"?: string | null,"provider"?: string | null,"rejected_reason"?: string | null,"status"?: string,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_group_links": {
                  Row: {
                    "expires_at": string,"group_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"group_id": string,"token_hash": string
                  }
                  Update: {
                    "expires_at"?: string,"group_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_group_links_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_link_tokens": {
                  Row: {
                    "expires_at": string,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_link_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "token": string }; Returns: string
                           },
"assert_member":
{ Args: { "gid": string,"uid": string }; Returns: undefined
                           },
"auto_confirm_settlements":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"consume_ai_quota":
{ Args: { "daily_limit": number,"kind": string }; Returns: boolean
                           },
"create_expense":
{ Args: { "discount_amount"?: number,"expense_note"?: string,"expense_title": string,"expense_total": number,"gid": string,"items"?: Json,"method": string,"on_date"?: string,"payer": string,"receipt"?: string,"service_amount"?: number,"shares": Json,"tax_amount"?: number }; Returns: string
                           },
"create_group":
{ Args: { "group_hull"?: string,"group_name": string }; Returns: string
                           },
"create_invite":
{ Args: { "gid": string,"uses_allowed"?: number,"valid_days"?: number }; Returns: string
                           },
"create_recurring_bill":
{ Args: { "bill_amount": number,"bill_title": string,"day": number,"gid": string,"payer": string,"people": (string)[] }; Returns: string
                           },
"create_telegram_group_link":
{ Args: { "gid": string }; Returns: string
                           },
"create_telegram_link":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decide_settlement":
{ Args: { "accept": boolean,"reason"?: string,"sid": string }; Returns: undefined
                           },
"delete_expense":
{ Args: { "eid": string }; Returns: undefined
                           },
"is_group_admin":
{ Args: { "gid": string }; Returns: boolean
                           },
"is_group_member":
{ Args: { "gid": string }; Returns: boolean
                           },
"mark_paid":
{ Args: { "gid": string,"paid_amount": number,"proof"?: string,"receiver": string,"settlement_note"?: string,"via"?: string }; Returns: string
                           },
"next_monthly":
{ Args: { "after": string,"day_of_month": number }; Returns: string
                           },
"path_owner":
{ Args: { "object_name": string }; Returns: string
                           },
"peek_invite":
{ Args: { "token": string }; Returns: {
              "group_name": string,"member_count": number
            }[]
                           },
"record_received":
{ Args: { "gid": string,"paid_amount": number,"payer": string,"settlement_note"?: string }; Returns: string
                           },
"run_recurring_bills":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"set_recurring_bill_active":
{ Args: { "bid": string,"is_active": boolean }; Returns: undefined
                           },
"shares_group_with":
{ Args: { "other": string }; Returns: boolean
                           },
"take_group_number":
{ Args: { "gid": string }; Returns: number
                           },
"unlink_telegram_group":
{ Args: { "gid": string }; Returns: undefined
                           },
"update_expense":
{ Args: { "discount_amount"?: number,"eid": string,"expense_note"?: string,"expense_title": string,"expense_total": number,"items"?: Json,"method": string,"on_date"?: string,"payer": string,"service_amount"?: number,"shares": Json,"tax_amount"?: number }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
