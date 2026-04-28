export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json | null
          resource: string
          resource_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          resource: string
          resource_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          resource?: string
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_templates: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_official_api: boolean | null
          message: string
          shortcut: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_official_api?: boolean | null
          message: string
          shortcut: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_official_api?: boolean | null
          message?: string
          shortcut?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          admin_notes: string | null
          APIOficial: boolean | null
          arroba_instagram_empresa: string | null
          billing_email: string | null
          block_reason: string | null
          blocked_at: string | null
          cnpj: string | null
          created_at: string | null
          contact_name: string | null
          email: string | null
          grace_period_days: number | null
          id: string
          id_instagram: string | null
          is_active: boolean | null
          last_activity_at: string | null
          logo_url: string | null
          max_users: number | null
          name: string
          phone: string | null
          plan: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          token_instagram: string | null
          trial_ends_at: string | null
          updated_at: string | null
          whatsapp_ai_phone: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          APIOficial?: boolean | null
          arroba_instagram_empresa?: string | null
          billing_email?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          cnpj?: string | null
          created_at?: string | null
          contact_name?: string | null
          email?: string | null
          grace_period_days?: number | null
          id?: string
          id_instagram?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          logo_url?: string | null
          max_users?: number | null
          name: string
          phone?: string | null
          plan?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          token_instagram?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          whatsapp_ai_phone?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          APIOficial?: boolean | null
          arroba_instagram_empresa?: string | null
          billing_email?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          cnpj?: string | null
          created_at?: string | null
          contact_name?: string | null
          email?: string | null
          grace_period_days?: number | null
          id?: string
          id_instagram?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          logo_url?: string | null
          max_users?: number | null
          name?: string
          phone?: string | null
          plan?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          token_instagram?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          whatsapp_ai_phone?: string | null
        }
        Relationships: []
      }
      company_access_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          meta: Json | null
          new_status: string | null
          performed_by: string | null
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          meta?: Json | null
          new_status?: string | null
          performed_by?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          new_status?: string | null
          performed_by?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_access_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_access_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_access_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_api_keys: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_name: string
          key_prefix: string
          last_used_at: string | null
          revoked_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_name?: string
          key_prefix: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_name?: string
          key_prefix?: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_features: {
        Row: {
          company_id: string
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          company_name_bold: boolean
          company_name_color: string
          company_name_font_family: string
          company_name_font_size: number
          company_subtitle_bold: boolean
          company_subtitle_color: string
          company_subtitle_font_family: string
          company_subtitle_font_size: number
          created_at: string | null
          display_name: string
          display_subtitle: string
          id: string
          language: string
          logo_size: number
          logo_url: string | null
          primary_color: string
          theme: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          company_name_bold?: boolean
          company_name_color?: string
          company_name_font_family?: string
          company_name_font_size?: number
          company_subtitle_bold?: boolean
          company_subtitle_color?: string
          company_subtitle_font_family?: string
          company_subtitle_font_size?: number
          created_at?: string | null
          display_name?: string
          display_subtitle?: string
          id?: string
          language?: string
          logo_size?: number
          logo_url?: string | null
          primary_color?: string
          theme?: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          company_name_bold?: boolean
          company_name_color?: string
          company_name_font_family?: string
          company_name_font_size?: number
          company_subtitle_bold?: boolean
          company_subtitle_color?: string
          company_subtitle_font_family?: string
          company_subtitle_font_size?: number
          created_at?: string | null
          display_name?: string
          display_subtitle?: string
          id?: string
          language?: string
          logo_size?: number
          logo_url?: string | null
          primary_color?: string
          theme?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
        ]
      }
      company_websites: {
        Row: {
          analytics_google: string | null
          company_id: string
          created_at: string | null
          description: string | null
          hero_images: Json | null
          id: string
          is_published: boolean | null
          logo_url: string | null
          pixel_facebook: string | null
          slug: string
          theme_color: string | null
          title: string
          title_color: string | null
          updated_at: string | null
          vitrine_extras: Json
        }
        Insert: {
          analytics_google?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          hero_images?: Json | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          pixel_facebook?: string | null
          slug: string
          theme_color?: string | null
          title: string
          title_color?: string | null
          updated_at?: string | null
          vitrine_extras?: Json
        }
        Update: {
          analytics_google?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          hero_images?: Json | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          pixel_facebook?: string | null
          slug?: string
          theme_color?: string | null
          title?: string
          title_color?: string | null
          updated_at?: string | null
          vitrine_extras?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_websites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_websites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_active: boolean | null
          name: string
          template_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          template_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          template_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_address: string | null
          client_cpf: string | null
          client_email: string | null
          client_id: string | null
          client_marital_status: string | null
          client_name: string
          client_nationality: string | null
          client_phone: string | null
          contract_city: string | null
          contract_duration: string | null
          contract_file_name: string | null
          contract_file_path: string | null
          created_at: string | null
          created_by: string | null
          data_assinatura: string | null
          data_fim: string
          data_inicio: string
          guarantor_address: string | null
          guarantor_cpf: string | null
          guarantor_email: string | null
          guarantor_marital_status: string | null
          guarantor_name: string | null
          guarantor_nationality: string | null
          guarantor_phone: string | null
          id: string
          is_active: boolean | null
          landlord_address: string | null
          landlord_cpf: string | null
          landlord_email: string | null
          landlord_marital_status: string | null
          landlord_name: string | null
          landlord_nationality: string | null
          landlord_phone: string | null
          numero: string
          payment_day: string | null
          payment_method: string | null
          property_address: string
          property_area: number | null
          property_city: string | null
          property_state: string | null
          property_title: string
          property_type: string | null
          property_zip_code: string | null
          proximo_vencimento: string | null
          status: string | null
          template_id: string | null
          template_name: string
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          client_address?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_id?: string | null
          client_marital_status?: string | null
          client_name: string
          client_nationality?: string | null
          client_phone?: string | null
          contract_city?: string | null
          contract_duration?: string | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string | null
          created_by?: string | null
          data_assinatura?: string | null
          data_fim: string
          data_inicio: string
          guarantor_address?: string | null
          guarantor_cpf?: string | null
          guarantor_email?: string | null
          guarantor_marital_status?: string | null
          guarantor_name?: string | null
          guarantor_nationality?: string | null
          guarantor_phone?: string | null
          id?: string
          is_active?: boolean | null
          landlord_address?: string | null
          landlord_cpf?: string | null
          landlord_email?: string | null
          landlord_marital_status?: string | null
          landlord_name?: string | null
          landlord_nationality?: string | null
          landlord_phone?: string | null
          numero: string
          payment_day?: string | null
          payment_method?: string | null
          property_address: string
          property_area?: number | null
          property_city?: string | null
          property_state?: string | null
          property_title: string
          property_type?: string | null
          property_zip_code?: string | null
          proximo_vencimento?: string | null
          status?: string | null
          template_id?: string | null
          template_name: string
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          client_address?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_id?: string | null
          client_marital_status?: string | null
          client_name?: string
          client_nationality?: string | null
          client_phone?: string | null
          contract_city?: string | null
          contract_duration?: string | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string | null
          created_by?: string | null
          data_assinatura?: string | null
          data_fim?: string
          data_inicio?: string
          guarantor_address?: string | null
          guarantor_cpf?: string | null
          guarantor_email?: string | null
          guarantor_marital_status?: string | null
          guarantor_name?: string | null
          guarantor_nationality?: string | null
          guarantor_phone?: string | null
          id?: string
          is_active?: boolean | null
          landlord_address?: string | null
          landlord_cpf?: string | null
          landlord_email?: string | null
          landlord_marital_status?: string | null
          landlord_name?: string | null
          landlord_nationality?: string | null
          landlord_phone?: string | null
          numero?: string
          payment_day?: string | null
          payment_method?: string | null
          property_address?: string
          property_area?: number | null
          property_city?: string | null
          property_state?: string | null
          property_title?: string
          property_type?: string | null
          property_zip_code?: string | null
          proximo_vencimento?: string | null
          status?: string | null
          template_id?: string | null
          template_name?: string
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_configurations: {
        Row: {
          assigned_brokers: Json | null
          broker_assignment_strategy: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          interval_between_messages: number | null
          is_active: boolean | null
          is_default: boolean | null
          max_messages_per_hour: number | null
          message_template: string
          name: string
          priority: number | null
          time_windows: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_brokers?: Json | null
          broker_assignment_strategy?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          interval_between_messages?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          max_messages_per_hour?: number | null
          message_template?: string
          name: string
          priority?: number | null
          time_windows?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_brokers?: Json | null
          broker_assignment_strategy?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          interval_between_messages?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          max_messages_per_hour?: number | null
          message_template?: string
          name?: string
          priority?: number | null
          time_windows?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_configurations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      imobipro_messages: {
        Row: {
          data: string | null
          id: number
          instancia: string | null
          media: string | null
          message: Json
          session_id: string
        }
        Insert: {
          data?: string | null
          id?: number
          instancia?: string | null
          media?: string | null
          message: Json
          session_id: string
        }
        Update: {
          data?: string | null
          id?: number
          instancia?: string | null
          media?: string | null
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      imobipro_messages_5519991679072: {
        Row: {
          data: string | null
          id: number
          instancia: string | null
          media: string | null
          message: Json
          session_id: string
        }
        Insert: {
          data?: string | null
          id?: number
          instancia?: string | null
          media?: string | null
          message: Json
          session_id: string
        }
        Update: {
          data?: string | null
          id?: number
          instancia?: string | null
          media?: string | null
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      imobipro_messages_559870230832: {
        Row: {
          data: string | null
          id: number
          instancia: string | null
          media: string | null
          message: Json
          session_id: string
        }
        Insert: {
          data?: string | null
          id?: number
          instancia?: string | null
          media?: string | null
          message: Json
          session_id: string
        }
        Update: {
          data?: string | null
          id?: number
          instancia?: string | null
          media?: string | null
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      imoveisvivareal: {
        Row: {
          accepts_partnership: boolean | null
          andar: number | null
          ano_construcao: number | null
          bairro: string | null
          banheiros: number | null
          blocos: number | null
          cep: string | null
          cidade: string | null
          company_id: string | null
          complemento: string | null
          created_at: string | null
          descricao: string | null
          disponibilidade: string | null
          disponibilidade_observacao: string | null
          endereco: string | null
          features: string[] | null
          garagem: number | null
          id: number
          imagens: string[] | null
          listing_id: string | null
          modalidade: string | null
          numero: string | null
          partnership_notes: string | null
          preco: number | null
          quartos: number | null
          suite: number | null
          tamanho_m2: number | null
          tipo_categoria: string | null
          tipo_imovel: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accepts_partnership?: boolean | null
          andar?: number | null
          ano_construcao?: number | null
          bairro?: string | null
          banheiros?: number | null
          blocos?: number | null
          cep?: string | null
          cidade?: string | null
          company_id?: string | null
          complemento?: string | null
          created_at?: string | null
          descricao?: string | null
          disponibilidade?: string | null
          disponibilidade_observacao?: string | null
          endereco?: string | null
          features?: string[] | null
          garagem?: number | null
          id?: number
          imagens?: string[] | null
          listing_id?: string | null
          modalidade?: string | null
          numero?: string | null
          partnership_notes?: string | null
          preco?: number | null
          quartos?: number | null
          suite?: number | null
          tamanho_m2?: number | null
          tipo_categoria?: string | null
          tipo_imovel?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepts_partnership?: boolean | null
          andar?: number | null
          ano_construcao?: number | null
          bairro?: string | null
          banheiros?: number | null
          blocos?: number | null
          cep?: string | null
          cidade?: string | null
          company_id?: string | null
          complemento?: string | null
          created_at?: string | null
          descricao?: string | null
          disponibilidade?: string | null
          disponibilidade_observacao?: string | null
          endereco?: string | null
          features?: string[] | null
          garagem?: number | null
          id?: number
          imagens?: string[] | null
          listing_id?: string | null
          modalidade?: string | null
          numero?: string | null
          partnership_notes?: string | null
          preco?: number | null
          quartos?: number | null
          suite?: number | null
          tamanho_m2?: number | null
          tipo_categoria?: string | null
          tipo_imovel?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imoveisvivareal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveisvivareal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveisvivareal_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          ended_at: string | null
          id: string
          impersonated_company_id: string | null
          impersonated_email: string
          impersonated_user_id: string
          ip_address: string | null
          is_active: boolean | null
          reason: string | null
          started_at: string
          super_admin_id: string
          user_agent: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          impersonated_company_id?: string | null
          impersonated_email: string
          impersonated_user_id: string
          ip_address?: string | null
          is_active?: boolean | null
          reason?: string | null
          started_at?: string
          super_admin_id: string
          user_agent?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          impersonated_company_id?: string | null
          impersonated_email?: string
          impersonated_user_id?: string
          ip_address?: string | null
          is_active?: boolean | null
          reason?: string | null
          started_at?: string
          super_admin_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_impersonated_company_id_fkey"
            columns: ["impersonated_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_impersonated_company_id_fkey"
            columns: ["impersonated_company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
        ]
      }
      inquilinato_conversations: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          last_message_at: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquilinato_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquilinato_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
        ]
      }
      inquilinato_messages: {
        Row: {
          company_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          email: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquilinato_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquilinato_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquilinato_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inquilinato_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          arroba_instagram_cliente: string | null
          instagram_id_cliente: string | null
          profile_pic_url_instagram: string | null
          last_profile_sync_instagram: string | null
          company_id: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          estado_civil: string | null
          estimated_value: number | null
          id: string
          id_corretor_responsavel: string | null
          imovel_interesse: string | null
          interest: string | null
          message: string | null
          name: string | null
          nome_instagram_cliente: string | null
          notes: string | null
          phone: string | null
          source: string | null
          stage: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          arroba_instagram_cliente?: string | null
          instagram_id_cliente?: string | null
          profile_pic_url_instagram?: string | null
          last_profile_sync_instagram?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          estimated_value?: number | null
          id?: string
          id_corretor_responsavel?: string | null
          imovel_interesse?: string | null
          interest?: string | null
          message?: string | null
          name?: string | null
          nome_instagram_cliente?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          arroba_instagram_cliente?: string | null
          instagram_id_cliente?: string | null
          profile_pic_url_instagram?: string | null
          last_profile_sync_instagram?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          estimated_value?: number | null
          id?: string
          id_corretor_responsavel?: string | null
          imovel_interesse?: string | null
          interest?: string | null
          message?: string | null
          name?: string | null
          nome_instagram_cliente?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_id_corretor_responsavel_fkey"
            columns: ["id_corretor_responsavel"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oncall_schedules: {
        Row: {
          assigned_user_id: string | null
          calendar_id: string
          calendar_name: string
          company_id: string
          created_at: string
          fri_end: string | null
          fri_start: string | null
          fri_works: boolean
          id: string
          mon_end: string | null
          mon_start: string | null
          mon_works: boolean
          sat_end: string | null
          sat_start: string | null
          sat_works: boolean
          sun_end: string | null
          sun_start: string | null
          sun_works: boolean
          thu_end: string | null
          thu_start: string | null
          thu_works: boolean
          tue_end: string | null
          tue_start: string | null
          tue_works: boolean
          updated_at: string
          user_id: string
          wed_end: string | null
          wed_start: string | null
          wed_works: boolean
        }
        Insert: {
          assigned_user_id?: string | null
          calendar_id: string
          calendar_name: string
          company_id: string
          created_at?: string
          fri_end?: string | null
          fri_start?: string | null
          fri_works?: boolean
          id?: string
          mon_end?: string | null
          mon_start?: string | null
          mon_works?: boolean
          sat_end?: string | null
          sat_start?: string | null
          sat_works?: boolean
          sun_end?: string | null
          sun_start?: string | null
          sun_works?: boolean
          thu_end?: string | null
          thu_start?: string | null
          thu_works?: boolean
          tue_end?: string | null
          tue_start?: string | null
          tue_works?: boolean
          updated_at?: string
          user_id: string
          wed_end?: string | null
          wed_start?: string | null
          wed_works?: boolean
        }
        Update: {
          assigned_user_id?: string | null
          calendar_id?: string
          calendar_name?: string
          company_id?: string
          created_at?: string
          fri_end?: string | null
          fri_start?: string | null
          fri_works?: boolean
          id?: string
          mon_end?: string | null
          mon_start?: string | null
          mon_works?: boolean
          sat_end?: string | null
          sat_start?: string | null
          sat_works?: boolean
          sun_end?: string | null
          sun_start?: string | null
          sun_works?: boolean
          thu_end?: string | null
          thu_start?: string | null
          thu_works?: boolean
          tue_end?: string | null
          tue_start?: string | null
          tue_works?: boolean
          updated_at?: string
          user_id?: string
          wed_end?: string | null
          wed_start?: string | null
          wed_works?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "oncall_schedules_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oncall_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oncall_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oncall_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_landing_pages: {
        Row: {
          company_id: string
          created_at: string | null
          custom_color: string | null
          id: string
          is_published: boolean | null
          page_title: string | null
          property_id: number
          slug: string
          updated_at: string | null
          views: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          custom_color?: string | null
          id?: string
          is_published?: boolean | null
          page_title?: string | null
          property_id: number
          slug: string
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          custom_color?: string | null
          id?: string
          is_published?: boolean | null
          page_title?: string | null
          property_id?: number
          slug?: string
          updated_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_landing_pages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_pages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_landing_pages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "imoveisvivareal"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          permission_key: string
          permission_name: string
          role: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          permission_key: string
          permission_name: string
          role: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          permission_key?: string
          permission_name?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          chat_instance: string | null
          company_id: string | null
          created_at: string | null
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          chat_instance?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          chat_instance?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_needing_attention"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      companies_needing_attention: {
        Row: {
          blocked_at: string | null
          created_at: string | null
          days_remaining: number | null
          email: string | null
          grace_period_days: number | null
          id: string | null
          name: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          user_count: number | null
        }
        Insert: {
          blocked_at?: string | null
          created_at?: string | null
          days_remaining?: never
          email?: string | null
          grace_period_days?: number | null
          id?: string | null
          name?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          user_count?: never
        }
        Update: {
          blocked_at?: string | null
          created_at?: string | null
          days_remaining?: never
          email?: string | null
          grace_period_days?: number | null
          id?: string | null
          name?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          user_count?: never
        }
        Relationships: []
      }
    }
    Functions: {
      admin_get_leads_by_period: {
        Args: { end_date: string; start_date: string }
        Returns: {
          company_id: string
          created_at: string
          lead_id: string
          source: string
          stage: string
        }[]
      }
      block_company: {
        Args: { p_company_id: string; p_reason?: string }
        Returns: boolean
      }
      check_and_update_subscriptions: {
        Args: never
        Returns: {
          execution_time: string
          updated_count: number
        }[]
      }
      check_company_access: {
        Args: { p_company_id: string }
        Returns: {
          can_access: boolean
          days_remaining: number
          is_grace_period: boolean
          message: string
          status: string
        }[]
      }
      check_current_user_access: {
        Args: never
        Returns: {
          can_access: boolean
          days_remaining: number
          is_grace_period: boolean
          is_super_admin: boolean
          message: string
          status: string
        }[]
      }
      conversation_for_user: {
        Args: { p_limit?: number; p_offset?: number; p_session_id: string }
        Returns: {
          before_handoff: boolean
          data: string
          handoff_ts: string
          id: number
          instancia: string
          media: string
          message: Json
          session_id: string
        }[]
      }
      conversation_for_user_by_phone: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_phone: string
          p_session_id: string
        }
        Returns: {
          before_handoff: boolean
          data: string
          handoff_ts: string
          id: number
          instancia: string
          media: string
          message: Json
          session_id: string
        }[]
      }
      create_company_manager: {
        Args: {
          p_company_id: string
          p_email: string
          p_full_name: string
          p_phone?: string
          p_user_id: string
        }
        Returns: string
      }
      create_company_messages_table: {
        Args: { p_whatsapp_ai_phone: string }
        Returns: undefined
      }
      create_company_with_trial: {
        Args: {
          p_address?: string
          p_cnpj?: string
          p_email?: string
          p_max_users?: number
          p_name: string
          p_phone?: string
          p_plan?: string
          p_trial_days?: number
          p_whatsapp_ai_phone: string
        }
        Returns: string
      }
      end_impersonation: { Args: never; Returns: boolean }
      get_active_impersonation: {
        Args: never
        Returns: {
          impersonated_company_id: string
          impersonated_email: string
          impersonated_user_id: string
          session_id: string
          started_at: string
        }[]
      }
      get_admin_metrics: {
        Args: never
        Returns: {
          active_companies: number
          active_users: number
          blocked_companies: number
          expired_companies: number
          grace_companies: number
          total_companies: number
          total_leads: number
          total_properties: number
          total_users: number
          trial_companies: number
        }[]
      }
      get_company_access_logs: {
        Args: { p_company_id?: string; p_limit?: number; p_offset?: number }
        Returns: {
          action: string
          company_id: string
          company_name: string
          created_at: string
          id: string
          meta: Json
          new_status: string
          performed_by: string
          performed_by_name: string
          previous_status: string
          reason: string
        }[]
      }
      get_company_details: {
        Args: { p_company_id: string }
        Returns: {
          address: string
          admin_notes: string
          billing_email: string
          block_reason: string
          blocked_at: string
          cnpj: string
          created_at: string
          email: string
          grace_period_days: number
          id: string
          is_active: boolean
          last_activity_at: string
          lead_count: number
          logo_url: string
          max_users: number
          name: string
          phone: string
          plan: string
          property_count: number
          subscription_expires_at: string
          subscription_status: string
          trial_ends_at: string
          updated_at: string
          user_count: number
        }[]
      }
      get_corretores_conversas_dev: {
        Args: never
        Returns: {
          company_id: string
          conversation_count: number
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      get_imoveis_for_dashboard: {
        Args: { end_date: string; start_date: string; trunc_type: string }
        Returns: {
          bucket: string
          imoveis: number
          vgv: number
        }[]
      }
      get_impersonation_history: {
        Args: { p_limit?: number }
        Returns: {
          company_name: string
          duration_minutes: number
          ended_at: string
          impersonated_email: string
          reason: string
          session_id: string
          started_at: string
          super_admin_email: string
        }[]
      }
      get_leads_for_dashboard: {
        Args: { end_date: string; start_date: string }
        Returns: {
          company_id: string
          created_at: string
          lead_id: string
          source: string
          stage: string
        }[]
      }
      get_own_company: {
        Args: never
        Returns: {
          address: string
          cnpj: string
          contact_name: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          logo_url: string
          max_users: number
          name: string
          phone: string
          plan: string
          subscription_expires_at: string
          subscription_status: string
          trial_ends_at: string
        }[]
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      increment_page_view: { Args: { page_id: string }; Returns: undefined }
      log_public_site_visit: {
        Args: {
          p_lp_slug?: string | null
          p_path?: string | null
          p_referrer?: string | null
          p_referrer_kind?: string | null
          p_site_slug?: string | null
          p_utm_medium?: string | null
          p_utm_source?: string | null
          p_visit_kind: string
        }
        Returns: undefined
      }
      is_admin_user: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      list_all_companies: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          block_reason: string
          blocked_at: string
          cnpj: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_activity_at: string
          lead_count: number
          max_users: number
          name: string
          phone: string
          plan: string
          property_count: number
          subscription_expires_at: string
          subscription_status: string
          trial_ends_at: string
          user_count: number
          whatsapp_ai_phone: string
        }[]
      }
      list_company_users: {
        Args: {
          limit_count?: number
          offset_count?: number
          roles?: string[]
          search?: string
          target_company_id?: string
        }
        Returns: {
          avatar_url: string
          company_id: string
          company_name: string
          created_at: string
          department: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string
          role: string
          updated_at: string
        }[]
      }
      list_conversations_by_phone: {
        Args: { p_instancia?: string; p_phone: string }
        Returns: {
          data: string
          instancia: string
          media: string
          message: Json
          session_id: string
        }[]
      }
      list_users_for_impersonation: {
        Args: { p_company_id?: string; p_search?: string }
        Returns: {
          company_id: string
          company_name: string
          email: string
          full_name: string
          is_active: boolean
          last_login: string
          role: string
          user_id: string
        }[]
      }
      renew_subscription: {
        Args: { p_company_id: string; p_days: number; p_notes?: string }
        Returns: boolean
      }
      start_impersonation: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: {
          company_name: string
          message: string
          session_id: string
          success: boolean
          user_email: string
          user_name: string
        }[]
      }
      unblock_company: {
        Args: { p_company_id: string; p_new_status?: string; p_reason?: string }
        Returns: boolean
      }
      update_company: {
        Args: {
          p_address?: string
          p_admin_notes?: string
          p_billing_email?: string
          p_cnpj?: string
          p_company_id: string
          p_email?: string
          p_max_users?: number
          p_name?: string
          p_phone?: string
          p_plan?: string
        }
        Returns: boolean
      }
      update_expired_company_status: { Args: never; Returns: number }
      update_own_company: {
        Args: {
          p_address?: string
          p_cnpj?: string
          p_contact_name?: string
          p_email?: string
          p_name?: string
          p_phone?: string
        }
        Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
