export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string,"id": number,"scope_unit_ids": (string)[],"tenant_id": string | null,"unit_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id": string,"id"?: never,"scope_unit_ids"?: (string)[],"tenant_id"?: string | null,"unit_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string,"id"?: never,"scope_unit_ids"?: (string)[],"tenant_id"?: string | null,"unit_id"?: string | null
                  }
                  Relationships: [

                  ]
                },"membership_units": {
                  Row: {
                    "membership_id": string,"tenant_id": string,"unit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "membership_id": string,"tenant_id": string,"unit_id": string
                  }
                  Update: {
                    "membership_id"?: string,"tenant_id"?: string,"unit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_units_tenant_id_membership_id_fkey"
      columns: ["tenant_id","membership_id"]
isOneToOne: false
      referencedRelation: "tenant_memberships"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "membership_units_tenant_id_unit_id_fkey"
      columns: ["tenant_id","unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"module_catalog": {
                  Row: {
                    "configurable": boolean,"dependencies": (string)[],"description": string,"key": string,"name": string,"permission": string,"route": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "configurable"?: boolean,"dependencies"?: (string)[],"description": string,"key": string,"name": string,"permission": string,"route": string,"version": number
                  }
                  Update: {
                    "configurable"?: boolean,"dependencies"?: (string)[],"description"?: string,"key"?: string,"name"?: string,"permission"?: string,"route"?: string,"version"?: number
                  }
                  Relationships: [

                  ]
                },"module_changes": {
                  Row: {
                    "actor_id": string,"enabled": boolean,"expires_at": string,"id": string,"module_key": string,"published_at": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"enabled": boolean,"expires_at"?: string,"id"?: string,"module_key": string,"published_at"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "actor_id"?: string,"enabled"?: boolean,"expires_at"?: string,"id"?: string,"module_key"?: string,"published_at"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_changes_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "module_catalog"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "module_changes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"module_test_records": {
                  Row: {
                    "label": string,"module_key": string,"tenant_id": string,"unit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "label"?: string,"module_key": string,"tenant_id": string,"unit_id": string
                  }
                  Update: {
                    "label"?: string,"module_key"?: string,"tenant_id"?: string,"unit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_test_records_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "module_catalog"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "module_test_records_tenant_id_unit_id_fkey"
      columns: ["tenant_id","unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"plan_modules": {
                  Row: {
                    "module_key": string,"plan_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "module_key": string,"plan_key": string
                  }
                  Update: {
                    "module_key"?: string,"plan_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_modules_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "module_catalog"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "plan_modules_plan_key_fkey"
      columns: ["plan_key"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["key"]
    }
                  ]
                },"plans": {
                  Row: {
                    "key": string,"monthly_cents": number,"name": string,"unit_limit": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"monthly_cents": number,"name": string,"unit_limit": number,"version"?: number
                  }
                  Update: {
                    "key"?: string,"monthly_cents"?: number,"name"?: string,"unit_limit"?: number,"version"?: number
                  }
                  Relationships: [

                  ]
                },"profiles": {
                  Row: {
                    "display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name"?: string,"id": string
                  }
                  Update: {
                    "display_name"?: string,"id"?: string
                  }
                  Relationships: [

                  ]
                },"support_grants": {
                  Row: {
                    "approver": string,"expires_at": string,"grantee": string,"id": string,"reason": string,"revoked_at": string | null,"scope": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approver": string,"expires_at": string,"grantee": string,"id"?: string,"reason": string,"revoked_at"?: string | null,"scope": string,"tenant_id": string
                  }
                  Update: {
                    "approver"?: string,"expires_at"?: string,"grantee"?: string,"id"?: string,"reason"?: string,"revoked_at"?: string | null,"scope"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_grants_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_configuration": {
                  Row: {
                    "brand": string,"export_until": string | null,"onboarding_state": string,"responsible_name": string,"suspended_at": string | null,"tenant_id": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand": string,"export_until"?: string | null,"onboarding_state"?: string,"responsible_name": string,"suspended_at"?: string | null,"tenant_id": string,"timezone"?: string
                  }
                  Update: {
                    "brand"?: string,"export_until"?: string | null,"onboarding_state"?: string,"responsible_name"?: string,"suspended_at"?: string | null,"tenant_id"?: string,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_configuration_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_connections": {
                  Row: {
                    "capability_state": string,"credential_state": string,"desired_mode": string,"evidence": string,"evolution_evidence": string,"icon_account_label": string,"icon_installer": string | null,"icon_name": string,"icon_state": string,"icon_updated_at": string | null,"installation_evidence": string,"installation_status": string,"last_test_at": string | null,"opening_mode": string,"return_url": string,"tenant_id": string,"test_state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capability_state"?: string,"credential_state"?: string,"desired_mode"?: string,"evidence"?: string,"evolution_evidence"?: string,"icon_account_label"?: string,"icon_installer"?: string | null,"icon_name"?: string,"icon_state"?: string,"icon_updated_at"?: string | null,"installation_evidence"?: string,"installation_status"?: string,"last_test_at"?: string | null,"opening_mode"?: string,"return_url"?: string,"tenant_id": string,"test_state"?: string
                  }
                  Update: {
                    "capability_state"?: string,"credential_state"?: string,"desired_mode"?: string,"evidence"?: string,"evolution_evidence"?: string,"icon_account_label"?: string,"icon_installer"?: string | null,"icon_name"?: string,"icon_state"?: string,"icon_updated_at"?: string | null,"installation_evidence"?: string,"installation_status"?: string,"last_test_at"?: string | null,"opening_mode"?: string,"return_url"?: string,"tenant_id"?: string,"test_state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_connections_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_entitlements": {
                  Row: {
                    "configured": boolean,"enabled": boolean,"module_key": string,"reason": string,"source": string,"tenant_id": string,"valid_from": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "configured"?: boolean,"enabled"?: boolean,"module_key": string,"reason"?: string,"source"?: string,"tenant_id": string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "configured"?: boolean,"enabled"?: boolean,"module_key"?: string,"reason"?: string,"source"?: string,"tenant_id"?: string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_entitlements_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "module_catalog"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "tenant_entitlements_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null,"role": string,"tenant_id": string,"unit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role": string,"tenant_id": string,"unit_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role"?: string,"tenant_id"?: string,"unit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_invitations_tenant_id_unit_id_fkey"
      columns: ["tenant_id","unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"tenant_memberships": {
                  Row: {
                    "id": string,"role": string,"status": string,"tenant_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"role": string,"status"?: string,"tenant_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"role"?: string,"status"?: string,"tenant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_memberships_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_subscriptions": {
                  Row: {
                    "plan_key": string,"state": string,"tenant_id": string,"unit_limit_override": number | null,"valid_from": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "plan_key": string,"state"?: string,"tenant_id": string,"unit_limit_override"?: number | null,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "plan_key"?: string,"state"?: string,"tenant_id"?: string,"unit_limit_override"?: number | null,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_subscriptions_plan_key_fkey"
      columns: ["plan_key"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"status"?: string
                  }
                  Relationships: [

                  ]
                },"units": {
                  Row: {
                    "active": boolean,"id": string,"name": string,"tenant_id": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id"?: string,"name": string,"tenant_id": string,"timezone"?: string
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"name"?: string,"tenant_id"?: string,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "units_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "invitation": string }; Returns: string
                           },
"add_tenant_unit":
{ Args: { "name": string,"tenant": string }; Returns: string
                           },
"agenda_availability":
{ Args: { "local_start": string,"tenant": string,"unit": string,"version_id": string }; Returns: Json
                           },
"agenda_block":
{ Args: { "idempotency_key": string,"local_end": string,"local_start": string,"reason": string,"resource": string,"tenant": string,"unit": string }; Returns: Json
                           },
"agenda_grid":
{ Args: { "local_day": string,"span"?: string,"tenant": string,"unit": string }; Returns: Json
                           },
"agenda_openings":
{ Args: { "local_day": string,"resources": (string)[],"tenant": string,"unit": string,"version_id": string }; Returns: Json
                           },
"agenda_release_block":
{ Args: { "block": string,"expected_version": number,"idempotency_key": string,"tenant": string,"unit": string }; Returns: Json
                           },
"agenda_reschedule":
{ Args: { "appointment": string,"expected_version": number,"hold_minutes"?: number,"idempotency_key": string,"local_start": string,"resources": (string)[],"tenant": string,"unit": string }; Returns: Json
                           },
"agenda_reserve":
{ Args: { "client": string,"confirm"?: boolean,"hold_minutes"?: number,"idempotency_key": string,"local_start": string,"resources": (string)[],"tenant": string,"unit": string,"version_id": string,"waitlist_entry"?: string }; Returns: Json
                           },
"agenda_transition":
{ Args: { "action": string,"appointment": string,"expected_version": number,"idempotency_key": string,"reason"?: string,"tenant": string,"unit": string }; Returns: Json
                           },
"agenda_waitlist":
{ Args: { "local_end"?: string,"local_start"?: string,"professional"?: string,"tenant": string,"unit": string,"version_id"?: string }; Returns: Json
                           },
"agenda_waitlist_cancel":
{ Args: { "entry": string,"expected_version": number,"idempotency_key": string,"tenant": string,"unit": string }; Returns: Json
                           },
"agenda_waitlist_join":
{ Args: { "client": string,"idempotency_key": string,"notes"?: string,"priority"?: number,"professionals"?: (string)[],"tenant": string,"unit": string,"version_id": string,"windows": Json }; Returns: Json
                           },
"catalog_availability":
{ Args: { "after_id"?: string,"local_end": string,"local_start": string,"tenant": string,"unit": string,"version_id"?: string }; Returns: Json
                           },
"catalog_service_history":
{ Args: { "after_version"?: number,"service": string,"tenant": string,"unit": string }; Returns: Json
                           },
"catalog_team_options":
{ Args: { "tenant": string,"unit": string }; Returns: Json
                           },
"check_access":
{ Args: { "module"?: string,"permission": string,"tenant": string,"unit": string }; Returns: boolean
                           },
"claim_flw_delivery":
{ Args: { "delivery": string,"tenant": string }; Returns: Json
                           },
"claim_invitation_delivery":
{ Args: { "invitation": string }; Returns: Json
                           },
"client_detail":
{ Args: { "client": string,"tenant": string,"unit": string }; Returns: Json
                           },
"complete_flw_manual_task":
{ Args: { "reference": string,"task": string,"tenant": string }; Returns: undefined
                           },
"configure_icon":
{ Args: { "account_label": string,"return_url": string,"tenant": string }; Returns: undefined
                           },
"console_snapshot":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delete_catalog_window":
{ Args: { "tenant": string,"unit": string,"window_id": string }; Returns: undefined
                           },
"expire_agenda_holds":
{ Args: { "tenant": string,"unit": string }; Returns: number
                           },
"export_tenant_metadata":
{ Args: { "tenant": string }; Returns: Json
                           },
"finish_flw_delivery":
{ Args: { "delivery": string,"lease": string,"outcome": string,"tenant": string }; Returns: boolean
                           },
"finish_invitation_delivery":
{ Args: { "invitation": string,"lease": string,"success": boolean }; Returns: undefined
                           },
"flw_capabilities":
{ Args: { "tenant": string,"unit": string }; Returns: Json
                           },
"flw_operations":
{ Args: { "tenant": string,"unit": string }; Returns: Json
                           },
"flw_work_candidates":
{ Args: { "tenant": string,"unit": string }; Returns: Json
                           },
"grant_support":
{ Args: { "grantee": string,"minutes": number,"reason": string,"scope": string,"tenant": string }; Returns: string
                           },
"invite_member":
{ Args: { "clinic_role": string,"email": string,"tenant": string,"unit": string }; Returns: string
                           },
"launch_context":
{ Args: { "destination"?: string }; Returns: {
              "id": string,"name": string,"slug": string
            }[]
                           },
"list_catalog":
{ Args: { "after_id"?: string,"kind"?: string,"query"?: string,"tenant": string,"unit": string }; Returns: Json
                           },
"merge_clients":
{ Args: { "confirmed"?: boolean,"reason": string,"source": string,"source_version": number,"survivor": string,"survivor_version": number,"tenant": string,"unit": string }; Returns: Json
                           },
"module_probe":
{ Args: { "module": string,"tenant": string,"unit": string }; Returns: string
                           },
"platform_context":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"platform_tenants":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name": string,"slug": string,"status": string
            }[]
                           },
"preview_client_import":
{ Args: { "rows": Json,"tenant": string,"unit": string }; Returns: Json
                           },
"preview_module":
{ Args: { "enabled": boolean,"module": string,"tenant": string }; Returns: string
                           },
"provision_tenant":
{ Args: { "brand": string,"email": string,"name": string,"plan": string,"request": string,"responsible": string,"slug": string,"timezone"?: string,"unit_name": string }; Returns: string
                           },
"publish_catalog_service":
{ Args: { "expected_version"?: number,"payload": Json,"service"?: string,"tenant": string,"unit": string }; Returns: string
                           },
"publish_module":
{ Args: { "change": string }; Returns: undefined
                           },
"record_flw_capability_test":
{ Args: { "account_label": string,"capability": string,"documentation": string,"limits_summary": string,"proof": string,"result": string,"sample_summary": string,"scope": string,"tenant": string,"unit": string }; Returns: undefined
                           },
"record_icon_installation":
{ Args: { "account_label": string,"desired_mode": string,"evidence": string,"evolution"?: string,"icon_name": string,"installation_status": string,"tenant": string }; Returns: undefined
                           },
"replay_flw_delivery":
{ Args: { "delivery": string,"reconciled"?: boolean,"tenant": string }; Returns: undefined
                           },
"request_flw_operation":
{ Args: { "correlation": string,"entity": string,"operation": string,"simulation"?: boolean,"tenant": string,"unit": string,"version": number }; Returns: Json
                           },
"request_invitation_delivery":
{ Args: { "invitation": string }; Returns: string
                           },
"revoke_invitation":
{ Args: { "invitation": string,"tenant": string }; Returns: undefined
                           },
"revoke_membership":
{ Args: { "membership": string,"tenant": string }; Returns: undefined
                           },
"revoke_support":
{ Args: { "grant_id": string }; Returns: undefined
                           },
"save_catalog_resource":
{ Args: { "expected_version"?: number,"payload": Json,"resource"?: string,"tenant": string,"unit": string }; Returns: string
                           },
"save_client":
{ Args: { "client"?: string,"email"?: string,"expected_version"?: number,"name": string,"phone"?: string,"reviewed"?: boolean,"tenant": string,"unit": string }; Returns: string
                           },
"search_clients":
{ Args: { "after_id"?: string,"query"?: string,"tenant": string,"unit": string }; Returns: Json
                           },
"set_catalog_timezone":
{ Args: { "tenant": string,"timezone": string,"unit": string }; Returns: undefined
                           },
"set_catalog_window":
{ Args: { "kind": string,"local_end": string,"local_start": string,"reason"?: string,"resource": string,"tenant": string,"unit": string,"window_id"?: string }; Returns: string
                           },
"set_client_link":
{ Args: { "client": string,"expected_version"?: number,"kind": string,"link"?: string,"link_state"?: string,"reference": string,"source": string,"tenant": string,"unit": string }; Returns: string
                           },
"set_member_scope":
{ Args: { "membership": string,"reason": string,"tenant": string,"units": (string)[] }; Returns: undefined
                           },
"set_module_override":
{ Args: { "enabled": boolean,"module": string,"reason": string,"tenant": string,"until_at": string }; Returns: undefined
                           },
"set_tenant_plan":
{ Args: { "plan": string,"reason": string,"tenant": string,"valid_until"?: string }; Returns: undefined
                           },
"set_tenant_status":
{ Args: { "export_until"?: string,"reason": string,"suspended": boolean,"tenant": string }; Returns: undefined
                           },
"support_diagnostics":
{ Args: { "tenant": string }; Returns: Json
                           },
"test_connection":
{ Args: { "tenant": string }; Returns: undefined
                           },
"test_module_change":
{ Args: { "change": string,"unit": string }; Returns: Json
                           },
"update_onboarding":
{ Args: { "brand": string,"reason": string,"responsible": string,"state": string,"tenant": string }; Returns: undefined
                           },
"update_subscription":
{ Args: { "reason"?: string,"state": string,"tenant": string,"unit_limit"?: number }; Returns: undefined
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
