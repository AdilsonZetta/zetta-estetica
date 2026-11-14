export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity": string,"entity_id": string,"id": number,"scope_unit_ids": (string)[],"tenant_id": string | null,"unit_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity": string,"entity_id": string,"id"?: never,"scope_unit_ids"?: (string)[],"tenant_id"?: string | null,"unit_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity"?: string,"entity_id"?: string,"id"?: never,"scope_unit_ids"?: (string)[],"tenant_id"?: string | null,"unit_id"?: string | null
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
                },"tenant_entitlements": {
                  Row: {
                    "enabled": boolean,"module_key": string,"tenant_id": string,"valid_from": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"module_key": string,"tenant_id": string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "enabled"?: boolean,"module_key"?: string,"tenant_id"?: string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
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
                    "active": boolean,"id": string,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id"?: string,"name": string,"tenant_id": string
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"name"?: string,"tenant_id"?: string
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
"check_access":
{ Args: { "module"?: string,"permission": string,"tenant": string,"unit": string }; Returns: boolean
                           },
"invite_member":
{ Args: { "clinic_role": string,"email": string,"tenant": string,"unit": string }; Returns: string
                           },
"platform_context":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"platform_tenants":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name": string,"slug": string,"status": string
            }[]
                           },
"revoke_invitation":
{ Args: { "invitation": string,"tenant": string }; Returns: undefined
                           },
"revoke_membership":
{ Args: { "membership": string,"tenant": string }; Returns: undefined
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
