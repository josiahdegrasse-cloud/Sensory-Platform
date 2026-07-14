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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_access_requests: {
        Row: {
          id: string
          org_id: string
          requested_at: string
          requester_email: string
          requester_id: string
          requester_name: string
          resolution_note: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          id?: string
          org_id: string
          requested_at?: string
          requester_email: string
          requester_id: string
          requester_name?: string
          resolution_note?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          id?: string
          org_id?: string
          requested_at?: string
          requester_email?: string
          requester_id?: string
          requester_name?: string
          resolution_note?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json
          org_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
          org_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commercialization_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          concept_test_id: string
          created_at: string
          created_by: string
          decision_record_id: string
          evidence_bundle_id: string | null
          id: string
          org_id: string | null
          packaging_image_id: string | null
          project_id: string | null
          report_snapshot: Json
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          concept_test_id: string
          created_at?: string
          created_by: string
          decision_record_id: string
          evidence_bundle_id?: string | null
          id?: string
          org_id?: string | null
          packaging_image_id?: string | null
          project_id?: string | null
          report_snapshot: Json
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          concept_test_id?: string
          created_at?: string
          created_by?: string
          decision_record_id?: string
          evidence_bundle_id?: string | null
          id?: string
          org_id?: string | null
          packaging_image_id?: string | null
          project_id?: string | null
          report_snapshot?: Json
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercialization_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercialization_reports_concept_test_id_fkey"
            columns: ["concept_test_id"]
            isOneToOne: false
            referencedRelation: "concept_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercialization_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercialization_reports_decision_record_id_fkey"
            columns: ["decision_record_id"]
            isOneToOne: false
            referencedRelation: "decision_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercialization_reports_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercialization_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercialization_reports_packaging_image_id_fkey"
            columns: ["packaging_image_id"]
            isOneToOne: false
            referencedRelation: "concept_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercialization_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      composition_profiles: {
        Row: {
          calcium_mg: number
          created_at: string
          fat: number
          id: string
          moisture: number
          org_id: string | null
          ph: number
          protein: number
          salt_content: number
          sample_id: string
        }
        Insert: {
          calcium_mg?: number
          created_at?: string
          fat?: number
          id?: string
          moisture?: number
          org_id?: string | null
          ph?: number
          protein?: number
          salt_content?: number
          sample_id: string
        }
        Update: {
          calcium_mg?: number
          created_at?: string
          fat?: number
          id?: string
          moisture?: number
          org_id?: string | null
          ph?: number
          protein?: number
          salt_content?: number
          sample_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "composition_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composition_profiles_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: true
            referencedRelation: "instrumental_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_generation_settings: {
        Row: {
          active: boolean
          created_at: string | null
          default_image_count: number
          default_model: string
          default_quality: string
          estimated_cost_per_image: number
          id: string
          max_images_per_concept: number
          monthly_budget: number
          org_id: string | null
          prompt_style: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          default_image_count?: number
          default_model?: string
          default_quality?: string
          estimated_cost_per_image?: number
          id?: string
          max_images_per_concept?: number
          monthly_budget?: number
          org_id?: string | null
          prompt_style?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          default_image_count?: number
          default_model?: string
          default_quality?: string
          estimated_cost_per_image?: number
          id?: string
          max_images_per_concept?: number
          monthly_budget?: number
          org_id?: string | null
          prompt_style?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_generation_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_image_generations: {
        Row: {
          completed_at: string | null
          concept_folder_name: string | null
          concept_name: string | null
          concept_snapshot: Json
          concept_test_id: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          estimated_cost: number | null
          food_type_slug: string | null
          id: string
          mode: string
          model: string
          org_id: string | null
          prompt: string
          prompt_style: string
          quality: string
          requested_count: number
          status: string
        }
        Insert: {
          completed_at?: string | null
          concept_folder_name?: string | null
          concept_name?: string | null
          concept_snapshot?: Json
          concept_test_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          food_type_slug?: string | null
          id?: string
          mode?: string
          model?: string
          org_id?: string | null
          prompt?: string
          prompt_style?: string
          quality?: string
          requested_count?: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          concept_folder_name?: string | null
          concept_name?: string | null
          concept_snapshot?: Json
          concept_test_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          food_type_slug?: string | null
          id?: string
          mode?: string
          model?: string
          org_id?: string | null
          prompt?: string
          prompt_style?: string
          quality?: string
          requested_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_image_generations_concept_test_id_fkey"
            columns: ["concept_test_id"]
            isOneToOne: false
            referencedRelation: "concept_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_image_generations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_image_generations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_images: {
        Row: {
          archived_at: string | null
          concept_test_id: string | null
          created_at: string | null
          generation_id: string | null
          id: string
          image_url: string
          mode: string | null
          model: string | null
          org_id: string | null
          performance_summary: Json
          prompt: string | null
          prompt_style: string
          quality: string | null
          review_status: string
          selected_for_panelists: boolean
          sort_order: number
          storage_path: string | null
        }
        Insert: {
          archived_at?: string | null
          concept_test_id?: string | null
          created_at?: string | null
          generation_id?: string | null
          id?: string
          image_url: string
          mode?: string | null
          model?: string | null
          org_id?: string | null
          performance_summary?: Json
          prompt?: string | null
          prompt_style?: string
          quality?: string | null
          review_status?: string
          selected_for_panelists?: boolean
          sort_order?: number
          storage_path?: string | null
        }
        Update: {
          archived_at?: string | null
          concept_test_id?: string | null
          created_at?: string | null
          generation_id?: string | null
          id?: string
          image_url?: string
          mode?: string | null
          model?: string | null
          org_id?: string | null
          performance_summary?: Json
          prompt?: string | null
          prompt_style?: string
          quality?: string | null
          review_status?: string
          selected_for_panelists?: boolean
          sort_order?: number
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_images_concept_test_id_fkey"
            columns: ["concept_test_id"]
            isOneToOne: false
            referencedRelation: "concept_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_images_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "concept_image_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_images_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_responses: {
        Row: {
          answers: Json
          concept_test_id: string | null
          created_at: string | null
          id: string
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          answers?: Json
          concept_test_id?: string | null
          created_at?: string | null
          id?: string
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          answers?: Json
          concept_test_id?: string | null
          created_at?: string | null
          id?: string
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_responses_concept_test_id_fkey"
            columns: ["concept_test_id"]
            isOneToOne: false
            referencedRelation: "concept_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_tests: {
        Row: {
          approval_notes: string | null
          archived_at: string | null
          assigned_panelist_ids: string[] | null
          brand_reference_image_id: string | null
          category: string
          concept_folder_name: string | null
          created_at: string | null
          description: string | null
          food_type_slug: string | null
          generated_image_ids: string[] | null
          id: string
          image_urls: string[] | null
          key_benefits: string | null
          launched_at: string | null
          name: string
          org_id: string | null
          panel_size: number
          price_point: string | null
          project_id: string | null
          questions: Json
          status: string
          target_market: string | null
          variant_dimensions: Json | null
        }
        Insert: {
          approval_notes?: string | null
          archived_at?: string | null
          assigned_panelist_ids?: string[] | null
          brand_reference_image_id?: string | null
          category?: string
          concept_folder_name?: string | null
          created_at?: string | null
          description?: string | null
          food_type_slug?: string | null
          generated_image_ids?: string[] | null
          id?: string
          image_urls?: string[] | null
          key_benefits?: string | null
          launched_at?: string | null
          name: string
          org_id?: string | null
          panel_size?: number
          price_point?: string | null
          project_id?: string | null
          questions?: Json
          status?: string
          target_market?: string | null
          variant_dimensions?: Json | null
        }
        Update: {
          approval_notes?: string | null
          archived_at?: string | null
          assigned_panelist_ids?: string[] | null
          brand_reference_image_id?: string | null
          category?: string
          concept_folder_name?: string | null
          created_at?: string | null
          description?: string | null
          food_type_slug?: string | null
          generated_image_ids?: string[] | null
          id?: string
          image_urls?: string[] | null
          key_benefits?: string | null
          launched_at?: string | null
          name?: string
          org_id?: string | null
          panel_size?: number
          price_point?: string | null
          project_id?: string | null
          questions?: Json
          status?: string
          target_market?: string | null
          variant_dimensions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_tests_brand_reference_image_id_fkey"
            columns: ["brand_reference_image_id"]
            isOneToOne: false
            referencedRelation: "concept_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_tests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_tests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_records: {
        Row: {
          confidence: number
          created_at: string
          created_by: string
          decision: string
          decision_fingerprint: string
          id: string
          issf_score: number
          method_version: string
          note: string
          org_id: string | null
          parent_decision_id: string | null
          project_id: string | null
          sample_id: string
          sample_name: string
        }
        Insert: {
          confidence: number
          created_at?: string
          created_by: string
          decision: string
          decision_fingerprint: string
          id?: string
          issf_score: number
          method_version: string
          note?: string
          org_id?: string | null
          parent_decision_id?: string | null
          project_id?: string | null
          sample_id: string
          sample_name: string
        }
        Update: {
          confidence?: number
          created_at?: string
          created_by?: string
          decision?: string
          decision_fingerprint?: string
          id?: string
          issf_score?: number
          method_version?: string
          note?: string
          org_id?: string | null
          parent_decision_id?: string | null
          project_id?: string | null
          sample_id?: string
          sample_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_records_parent_decision_id_fkey"
            columns: ["parent_decision_id"]
            isOneToOne: false
            referencedRelation: "decision_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      e_tongue_measurements: {
        Row: {
          bitterness: number
          created_at: string
          id: string
          org_id: string | null
          saltiness: number
          sample_id: string
          sourness: number
          sweetness: number
          umami: number
        }
        Insert: {
          bitterness?: number
          created_at?: string
          id?: string
          org_id?: string | null
          saltiness?: number
          sample_id: string
          sourness?: number
          sweetness?: number
          umami?: number
        }
        Update: {
          bitterness?: number
          created_at?: string
          id?: string
          org_id?: string | null
          saltiness?: number
          sample_id?: string
          sourness?: number
          sweetness?: number
          umami?: number
        }
        Relationships: [
          {
            foreignKeyName: "e_tongue_measurements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_tongue_measurements_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "instrumental_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_bundles: {
        Row: {
          created_at: string
          created_by: string
          id: string
          org_id: string | null
          payload: Json
          sample_id: string
          schema_version: string
          source_data_version: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          org_id?: string | null
          payload: Json
          sample_id: string
          schema_version: string
          source_data_version: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string | null
          payload?: Json
          sample_id?: string
          schema_version?: string
          source_data_version?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidence_bundles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_bundles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_types: {
        Row: {
          aliases: string[]
          created_at: string
          created_by: string | null
          id: string
          label: string
          org_id: string | null
          slug: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          org_id?: string | null
          slug: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          org_id?: string | null
          slug?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gcms_compounds: {
        Row: {
          aroma: string
          concentration: number
          created_at: string
          id: string
          name: string
          org_id: string | null
          sample_id: string
          threshold: number
        }
        Insert: {
          aroma?: string
          concentration?: number
          created_at?: string
          id?: string
          name: string
          org_id?: string | null
          sample_id: string
          threshold?: number
        }
        Update: {
          aroma?: string
          concentration?: number
          created_at?: string
          id?: string
          name?: string
          org_id?: string | null
          sample_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "gcms_compounds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gcms_compounds_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "instrumental_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          archived_at: string | null
          deleted_at: string | null
          detection_confidence: number
          file_name: string
          food_type_id: string
          id: string
          idempotency_key: string | null
          ignored_columns: string[]
          imported_at: string
          imported_by: string | null
          org_id: string | null
          project_id: string | null
          recognized_columns: string[]
          reformulation_notes: string | null
          row_count: number
          status: string
          status_before_archive: string | null
        }
        Insert: {
          archived_at?: string | null
          deleted_at?: string | null
          detection_confidence?: number
          file_name: string
          food_type_id: string
          id?: string
          idempotency_key?: string | null
          ignored_columns?: string[]
          imported_at?: string
          imported_by?: string | null
          org_id?: string | null
          project_id?: string | null
          recognized_columns?: string[]
          reformulation_notes?: string | null
          row_count?: number
          status?: string
          status_before_archive?: string | null
        }
        Update: {
          archived_at?: string | null
          deleted_at?: string | null
          detection_confidence?: number
          file_name?: string
          food_type_id?: string
          id?: string
          idempotency_key?: string | null
          ignored_columns?: string[]
          imported_at?: string
          imported_by?: string | null
          org_id?: string | null
          project_id?: string | null
          recognized_columns?: string[]
          reformulation_notes?: string | null
          row_count?: number
          status?: string
          status_before_archive?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_food_type_id_fkey"
            columns: ["food_type_id"]
            isOneToOne: false
            referencedRelation: "food_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mapping_presets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mappings: Json
          name: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mappings?: Json
          name: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mappings?: Json
          name?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_mapping_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_mapping_presets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instrumental_samples: {
        Row: {
          category: string | null
          created_at: string
          food_type_id: string
          id: string
          import_batch_id: string
          org_id: string | null
          project_id: string | null
          sample_id: string
          sample_name: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          food_type_id: string
          id?: string
          import_batch_id: string
          org_id?: string | null
          project_id?: string | null
          sample_id: string
          sample_name?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          food_type_id?: string
          id?: string
          import_batch_id?: string
          org_id?: string | null
          project_id?: string | null
          sample_id?: string
          sample_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instrumental_samples_food_type_id_fkey"
            columns: ["food_type_id"]
            isOneToOne: false
            referencedRelation: "food_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumental_samples_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumental_samples_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumental_samples_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      org_email_domains: {
        Row: {
          created_at: string
          domain: string
          org_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          org_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_email_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      panelist_kit_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          kit_id: string
          metadata: Json
          org_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          kit_id: string
          metadata?: Json
          org_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          kit_id?: string
          metadata?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panelist_kit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panelist_kit_events_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "panelist_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panelist_kit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      panelist_kits: {
        Row: {
          assigned_product_ids: string[]
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          handling_instructions: string
          id: string
          issue_note: string | null
          issue_reported_at: string | null
          issue_status: string
          issue_type: string | null
          kit_code: string
          manual_code: string | null
          org_id: string
          packed_at: string | null
          printed_at: string | null
          product_id: string
          recipient_address: string | null
          recipient_email: string | null
          recipient_name: string | null
          replacement_for_kit_id: string | null
          response_deadline: string | null
          sample_code: string | null
          shipped_at: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          token_hash: string
          tracking_number: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          assigned_product_ids?: string[]
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          handling_instructions?: string
          id?: string
          issue_note?: string | null
          issue_reported_at?: string | null
          issue_status?: string
          issue_type?: string | null
          kit_code: string
          manual_code?: string | null
          org_id: string
          packed_at?: string | null
          printed_at?: string | null
          product_id: string
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          replacement_for_kit_id?: string | null
          response_deadline?: string | null
          sample_code?: string | null
          shipped_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          token_hash: string
          tracking_number?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          assigned_product_ids?: string[]
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          handling_instructions?: string
          id?: string
          issue_note?: string | null
          issue_reported_at?: string | null
          issue_status?: string
          issue_type?: string | null
          kit_code?: string
          manual_code?: string | null
          org_id?: string
          packed_at?: string | null
          printed_at?: string | null
          product_id?: string
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          replacement_for_kit_id?: string | null
          response_deadline?: string | null
          sample_code?: string | null
          shipped_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          token_hash?: string
          tracking_number?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panelist_kits_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panelist_kits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panelist_kits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panelist_kits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panelist_kits_replacement_for_kit_id_fkey"
            columns: ["replacement_for_kit_id"]
            isOneToOne: false
            referencedRelation: "panelist_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_imports: {
        Row: {
          created_at: string
          error_message: string | null
          file_name: string
          id: string
          matched_batch_id: string | null
          org_id: string
          parse_preview: Json | null
          source: string
          source_file_id: string | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_name: string
          id?: string
          matched_batch_id?: string | null
          org_id: string
          parse_preview?: Json | null
          source?: string
          source_file_id?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_name?: string
          id?: string
          matched_batch_id?: string | null
          org_id?: string
          parse_preview?: Json | null
          source?: string
          source_file_id?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_imports_matched_batch_id_fkey"
            columns: ["matched_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          assigned_panelist_ids: string[] | null
          blind_code: string | null
          blinded: boolean
          category: string
          created_at: string | null
          custom_attributes: Json | null
          id: string
          is_calibration: boolean
          is_multi_sample: boolean | null
          name: string
          org_id: string | null
          project_id: string | null
          reference_scores: Json | null
          samples: Json | null
          source_import_batch_id: string | null
          source_sample_id: string | null
          status: string
          status_before_archive: string | null
        }
        Insert: {
          assigned_panelist_ids?: string[] | null
          blind_code?: string | null
          blinded?: boolean
          category: string
          created_at?: string | null
          custom_attributes?: Json | null
          id?: string
          is_calibration?: boolean
          is_multi_sample?: boolean | null
          name: string
          org_id?: string | null
          project_id?: string | null
          reference_scores?: Json | null
          samples?: Json | null
          source_import_batch_id?: string | null
          source_sample_id?: string | null
          status?: string
          status_before_archive?: string | null
        }
        Update: {
          assigned_panelist_ids?: string[] | null
          blind_code?: string | null
          blinded?: boolean
          category?: string
          created_at?: string | null
          custom_attributes?: Json | null
          id?: string
          is_calibration?: boolean
          is_multi_sample?: boolean | null
          name?: string
          org_id?: string | null
          project_id?: string | null
          reference_scores?: Json | null
          samples?: Json | null
          source_import_batch_id?: string | null
          source_sample_id?: string | null
          status?: string
          status_before_archive?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_source_import_batch_id_fkey"
            columns: ["source_import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          consent_accepted_at: string | null
          consent_user_agent: string | null
          consent_version: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          org_id: string | null
          panelist_id: string | null
          phone: string | null
          postal_code: string | null
          profile_completed_at: string | null
          region: string | null
          role: string
          status: string
          training_level: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          consent_accepted_at?: string | null
          consent_user_agent?: string | null
          consent_version?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          org_id?: string | null
          panelist_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_completed_at?: string | null
          region?: string | null
          role?: string
          status?: string
          training_level?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          consent_accepted_at?: string | null
          consent_user_agent?: string | null
          consent_version?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          panelist_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_completed_at?: string | null
          region?: string | null
          role?: string
          status?: string
          training_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          food_type_id: string
          id: string
          name: string
          org_id: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          food_type_id: string
          id?: string
          name: string
          org_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          food_type_id?: string
          id?: string
          name?: string
          org_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_food_type_id_fkey"
            columns: ["food_type_id"]
            isOneToOne: false
            referencedRelation: "food_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_audit_events: {
        Row: {
          action: string
          details_json: Json
          id: string
          occurred_at: string
          outcome: string
          request_id: string
          resource_id: string
          resource_type: string
          role: string
          subject: string
          tenant_id: string
        }
        Insert: {
          action: string
          details_json?: Json
          id: string
          occurred_at: string
          outcome: string
          request_id: string
          resource_id: string
          resource_type: string
          role: string
          subject: string
          tenant_id: string
        }
        Update: {
          action?: string
          details_json?: Json
          id?: string
          occurred_at?: string
          outcome?: string
          request_id?: string
          resource_id?: string
          resource_type?: string
          role?: string
          subject?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["slug"]
          },
        ]
      }
      rag_auth_login_states: {
        Row: {
          expires_at: string
          payload_json: string
          state: string
        }
        Insert: {
          expires_at: string
          payload_json: string
          state: string
        }
        Update: {
          expires_at?: string
          payload_json?: string
          state?: string
        }
        Relationships: []
      }
      rag_auth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          payload_json: string
          session_id: string
        }
        Insert: {
          created_at: string
          expires_at: string
          payload_json: string
          session_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          payload_json?: string
          session_id?: string
        }
        Relationships: []
      }
      rag_chunks: {
        Row: {
          chunk_id: string
          chunk_index: number
          document_id: string
          embedding: string
          evidence_type: string
          heading: string
          library_id: string
          method_tags: string
          page_end: number
          page_start: number
          parent_id: string
          parent_text: string
          search_vector: unknown
          section: string
          source_path: string
          tenant_id: string
          text: string
          title: string
          topic_tags: string
        }
        Insert: {
          chunk_id: string
          chunk_index: number
          document_id: string
          embedding: string
          evidence_type?: string
          heading?: string
          library_id: string
          method_tags?: string
          page_end: number
          page_start: number
          parent_id?: string
          parent_text?: string
          search_vector?: unknown
          section: string
          source_path: string
          tenant_id: string
          text: string
          title: string
          topic_tags?: string
        }
        Update: {
          chunk_id?: string
          chunk_index?: number
          document_id?: string
          embedding?: string
          evidence_type?: string
          heading?: string
          library_id?: string
          method_tags?: string
          page_end?: number
          page_start?: number
          parent_id?: string
          parent_text?: string
          search_vector?: unknown
          section?: string
          source_path?: string
          tenant_id?: string
          text?: string
          title?: string
          topic_tags?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["slug"]
          },
        ]
      }
      rag_index_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      rag_jobs: {
        Row: {
          attempts: number
          cancel_requested: boolean
          created_at: string
          error: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          kind: string
          max_attempts: number
          payload_json: string
          result_json: string | null
          started_at: string | null
          status: string
          tenant_id: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          cancel_requested?: boolean
          created_at: string
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id: string
          kind: string
          max_attempts?: number
          payload_json?: string
          result_json?: string | null
          started_at?: string | null
          status: string
          tenant_id: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          cancel_requested?: boolean
          created_at?: string
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          kind?: string
          max_attempts?: number
          payload_json?: string
          result_json?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["slug"]
          },
        ]
      }
      responses: {
        Row: {
          cata_attributes: Json | null
          comments: string | null
          created_at: string | null
          different_sample: string | null
          emotional_profile: Json | null
          hedonic_scores: Json | null
          id: string
          intensity_ratings: Json | null
          org_id: string | null
          presentation_order: string[] | null
          product_id: string
          ranking: string[] | null
          run_number: number
          sample_code: string | null
          session_type: string | null
          user_id: string
        }
        Insert: {
          cata_attributes?: Json | null
          comments?: string | null
          created_at?: string | null
          different_sample?: string | null
          emotional_profile?: Json | null
          hedonic_scores?: Json | null
          id?: string
          intensity_ratings?: Json | null
          org_id?: string | null
          presentation_order?: string[] | null
          product_id: string
          ranking?: string[] | null
          run_number?: number
          sample_code?: string | null
          session_type?: string | null
          user_id: string
        }
        Update: {
          cata_attributes?: Json | null
          comments?: string | null
          created_at?: string | null
          different_sample?: string | null
          emotional_profile?: Json | null
          hedonic_scores?: Json | null
          id?: string
          intensity_ratings?: Json | null
          org_id?: string | null
          presentation_order?: string[] | null
          product_id?: string
          ranking?: string[] | null
          run_number?: number
          sample_code?: string | null
          session_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          attributes: Json
          created_at: string | null
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          attributes: Json
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          attributes?: Json
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          accent_color: string | null
          admin_contact_email: string | null
          allow_panelist_comments: boolean
          allow_panelists_view_history: boolean
          allow_self_signup: boolean
          anonymize_panelists_in_reports: boolean
          auto_create_food_types: boolean
          auto_create_surveys_from_imports: boolean
          brand_kit: Json
          concept_max_generations_per_concept: number
          concept_monthly_budget_cents: number
          concept_require_approval: boolean
          created_at: string
          data_retention_months: number
          decision_go_threshold: number
          decision_lock_confirmed: boolean
          decision_min_responses: number
          decision_stop_threshold: number
          default_panel_size: number
          default_report_title: string | null
          default_timezone: string
          drive_folder_id: string | null
          drive_folder_name: string | null
          duplicate_sample_policy: string
          export_format: string
          inactive_panelist_days: number
          logo_url: string | null
          notify_on_completion_target: boolean
          notify_on_generation_failure: boolean
          notify_on_import: boolean
          org_id: string
          organization_name: string
          primary_color: string | null
          report_footer: string
          report_template: string | null
          report_tone: string | null
          require_all_samples_before_submit: boolean
          require_emotion_section: boolean
          require_hedonic_section: boolean
          require_import_review: boolean
          require_intensity_section: boolean
          require_panelist_consent: boolean
          require_panelist_id: boolean
          updated_at: string
          workspace_name: string
        }
        Insert: {
          accent_color?: string | null
          admin_contact_email?: string | null
          allow_panelist_comments?: boolean
          allow_panelists_view_history?: boolean
          allow_self_signup?: boolean
          anonymize_panelists_in_reports?: boolean
          auto_create_food_types?: boolean
          auto_create_surveys_from_imports?: boolean
          brand_kit?: Json
          concept_max_generations_per_concept?: number
          concept_monthly_budget_cents?: number
          concept_require_approval?: boolean
          created_at?: string
          data_retention_months?: number
          decision_go_threshold?: number
          decision_lock_confirmed?: boolean
          decision_min_responses?: number
          decision_stop_threshold?: number
          default_panel_size?: number
          default_report_title?: string | null
          default_timezone?: string
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          duplicate_sample_policy?: string
          export_format?: string
          inactive_panelist_days?: number
          logo_url?: string | null
          notify_on_completion_target?: boolean
          notify_on_generation_failure?: boolean
          notify_on_import?: boolean
          org_id: string
          organization_name?: string
          primary_color?: string | null
          report_footer?: string
          report_template?: string | null
          report_tone?: string | null
          require_all_samples_before_submit?: boolean
          require_emotion_section?: boolean
          require_hedonic_section?: boolean
          require_import_review?: boolean
          require_intensity_section?: boolean
          require_panelist_consent?: boolean
          require_panelist_id?: boolean
          updated_at?: string
          workspace_name?: string
        }
        Update: {
          accent_color?: string | null
          admin_contact_email?: string | null
          allow_panelist_comments?: boolean
          allow_panelists_view_history?: boolean
          allow_self_signup?: boolean
          anonymize_panelists_in_reports?: boolean
          auto_create_food_types?: boolean
          auto_create_surveys_from_imports?: boolean
          brand_kit?: Json
          concept_max_generations_per_concept?: number
          concept_monthly_budget_cents?: number
          concept_require_approval?: boolean
          created_at?: string
          data_retention_months?: number
          decision_go_threshold?: number
          decision_lock_confirmed?: boolean
          decision_min_responses?: number
          decision_stop_threshold?: number
          default_panel_size?: number
          default_report_title?: string | null
          default_timezone?: string
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          duplicate_sample_policy?: string
          export_format?: string
          inactive_panelist_days?: number
          logo_url?: string | null
          notify_on_completion_target?: boolean
          notify_on_generation_failure?: boolean
          notify_on_import?: boolean
          org_id?: string
          organization_name?: string
          primary_color?: string | null
          report_footer?: string
          report_template?: string | null
          report_tone?: string | null
          require_all_samples_before_submit?: boolean
          require_emotion_section?: boolean
          require_hedonic_section?: boolean
          require_import_review?: boolean
          require_intensity_section?: boolean
          require_panelist_consent?: boolean
          require_panelist_id?: boolean
          updated_at?: string
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_panelist_kit: {
        Args: { p_manual_code?: string; p_token?: string }
        Returns: {
          assigned_product_count: number
          assigned_product_ids: string[]
          calculated_status: string
          claimed_by_current_user: boolean
          expires_at: string
          handling_instructions: string
          id: string
          is_multi_sample: boolean
          issue_status: string
          issue_type: string
          kit_code: string
          manual_code: string
          org_id: string
          product_category: string
          product_id: string
          product_name: string
          response_deadline: string
          sample_code: string
        }[]
      }
      complete_panelist_profile: {
        Args: {
          p_address_line_1: string
          p_address_line_2?: string
          p_city?: string
          p_consent_user_agent?: string
          p_consent_version?: string
          p_country?: string
          p_name: string
          p_phone: string
          p_postal_code?: string
          p_region?: string
        }
        Returns: undefined
      }
      create_commercialization_report: {
        Args: {
          target_concept_test_id: string
          target_decision_record_id: string
          target_packaging_image_id: string
          target_report_snapshot: Json
          target_title: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          concept_test_id: string
          created_at: string
          created_by: string
          decision_record_id: string
          evidence_bundle_id: string | null
          id: string
          org_id: string | null
          packaging_image_id: string | null
          project_id: string | null
          report_snapshot: Json
          status: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "commercialization_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_evidence_bundle: {
        Args: {
          target_payload: Json
          target_sample_id: string
          target_schema_version: string
          target_source_data_version: string
        }
        Returns: {
          created_at: string
          created_by: string
          id: string
          org_id: string | null
          payload: Json
          sample_id: string
          schema_version: string
          source_data_version: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "evidence_bundles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_instrumental_import: { Args: { payload: Json }; Returns: string }
      create_replacement_panelist_kit: {
        Args: { p_reason?: string; target_kit_id: string }
        Returns: {
          assigned_product_ids: string[]
          created_at: string
          expires_at: string
          handling_instructions: string
          id: string
          kit_code: string
          manual_code: string
          product_id: string
          recipient_email: string
          recipient_name: string
          response_deadline: string
          sample_code: string
          status: string
          token: string
        }[]
      }
      current_org_id: { Args: never; Returns: string }
      current_org_slug: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_import_batch: {
        Args: { target_batch_id: string }
        Returns: undefined
      }
      email_domain_has_workspace: {
        Args: { p_email: string }
        Returns: boolean
      }
      fetch_panelist_kit_events: {
        Args: { target_kit_id: string }
        Returns: {
          actor_id: string
          actor_name: string
          created_at: string
          event_type: string
          id: string
          kit_id: string
          metadata: Json
        }[]
      }
      generate_panelist_kit_manual_code: { Args: never; Returns: string }
      generate_panelist_kits: {
        Args: {
          kit_count: number
          p_assigned_product_ids?: string[]
          p_expires_at?: string
          p_handling_instructions?: string
          p_panelist_ids?: string[]
          p_recipients?: Json
          p_response_deadline?: string
          target_product_id: string
        }
        Returns: {
          assigned_product_ids: string[]
          claimed_by: string
          created_at: string
          expires_at: string
          handling_instructions: string
          id: string
          kit_code: string
          manual_code: string
          product_id: string
          recipient_address: string
          recipient_email: string
          recipient_name: string
          response_deadline: string
          sample_code: string
          status: string
          token: string
        }[]
      }
      get_panelist_kit_by_manual_code: {
        Args: { p_manual_code: string }
        Returns: {
          assigned_product_count: number
          calculated_status: string
          claimed_by_current_user: boolean
          expires_at: string
          handling_instructions: string
          is_multi_sample: boolean
          issue_status: string
          issue_type: string
          kit_code: string
          org_id: string
          product_category: string
          product_name: string
          response_deadline: string
          sample_code: string
        }[]
      }
      get_panelist_kit_by_token: {
        Args: { p_token: string }
        Returns: {
          assigned_product_count: number
          calculated_status: string
          claimed_by_current_user: boolean
          expires_at: string
          handling_instructions: string
          is_multi_sample: boolean
          issue_status: string
          issue_type: string
          kit_code: string
          org_id: string
          product_category: string
          product_name: string
          response_deadline: string
          sample_code: string
        }[]
      }
      get_public_workspace_config: {
        Args: { org_slug?: string }
        Returns: {
          accent_color: string
          allow_self_signup: boolean
          logo_url: string
          primary_color: string
          workspace_name: string
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_public_email_domain: { Args: { p_domain: string }; Returns: boolean }
      list_panelist_kits: {
        Args: { target_product_id: string }
        Returns: {
          assigned_product_count: number
          assigned_product_ids: string[]
          calculated_status: string
          claimed_at: string
          claimed_by: string
          claimed_panelist_name: string
          completed_product_count: number
          created_at: string
          expires_at: string
          handling_instructions: string
          id: string
          issue_note: string
          issue_reported_at: string
          issue_status: string
          issue_type: string
          kit_code: string
          manual_code: string
          packed_at: string
          printed_at: string
          product_id: string
          product_name: string
          recipient_address: string
          recipient_email: string
          recipient_name: string
          reminder_count: number
          replacement_for_kit_id: string
          response_deadline: string
          sample_code: string
          shipped_at: string
          started_at: string
          stored_status: string
          submitted_at: string
          tracking_number: string
          void_reason: string
          voided_at: string
        }[]
      }
      mark_panelist_kit_started: {
        Args: { p_manual_code?: string; p_token?: string }
        Returns: undefined
      }
      mark_panelist_kit_submitted: {
        Args: { p_manual_code?: string; p_token?: string }
        Returns: undefined
      }
      org_id_for_email: { Args: { p_email: string }; Returns: string }
      panelist_kit_token_hash: { Args: { p_token: string }; Returns: string }
      provision_organization: {
        Args: { org_name: string; org_slug: string }
        Returns: string
      }
      record_panelist_kit_event: {
        Args: { p_event_type: string; p_metadata?: Json; target_kit_id: string }
        Returns: undefined
      }
      record_panelist_kit_reminder: {
        Args: { p_reason?: string; target_kit_id: string }
        Returns: undefined
      }
      report_panelist_kit_issue: {
        Args: {
          p_issue_note?: string
          p_issue_type?: string
          p_manual_code?: string
          p_token?: string
        }
        Returns: undefined
      }
      request_admin_access: {
        Args: never
        Returns: {
          org_id: string
          request_id: string
          request_status: string
        }[]
      }
      resolve_admin_access_request: {
        Args: { decision: string; note?: string; target_request_id: string }
        Returns: undefined
      }
      set_food_type_status: {
        Args: { next_status: string; target_slug: string }
        Returns: undefined
      }
      set_import_batch_status: {
        Args: { next_status: string; target_batch_id: string }
        Returns: undefined
      }
      update_panelist_kit_fulfillment: {
        Args: {
          p_status: string
          p_tracking_number?: string
          target_kit_id: string
        }
        Returns: undefined
      }
      upsert_workspace_settings: {
        Args: { patch: Json }
        Returns: {
          accent_color: string | null
          admin_contact_email: string | null
          allow_panelist_comments: boolean
          allow_panelists_view_history: boolean
          allow_self_signup: boolean
          anonymize_panelists_in_reports: boolean
          auto_create_food_types: boolean
          auto_create_surveys_from_imports: boolean
          brand_kit: Json
          concept_max_generations_per_concept: number
          concept_monthly_budget_cents: number
          concept_require_approval: boolean
          created_at: string
          data_retention_months: number
          decision_go_threshold: number
          decision_lock_confirmed: boolean
          decision_min_responses: number
          decision_stop_threshold: number
          default_panel_size: number
          default_report_title: string | null
          default_timezone: string
          drive_folder_id: string | null
          drive_folder_name: string | null
          duplicate_sample_policy: string
          export_format: string
          inactive_panelist_days: number
          logo_url: string | null
          notify_on_completion_target: boolean
          notify_on_generation_failure: boolean
          notify_on_import: boolean
          org_id: string
          organization_name: string
          primary_color: string | null
          report_footer: string
          report_template: string | null
          report_tone: string | null
          require_all_samples_before_submit: boolean
          require_emotion_section: boolean
          require_hedonic_section: boolean
          require_import_review: boolean
          require_intensity_section: boolean
          require_panelist_consent: boolean
          require_panelist_id: boolean
          updated_at: string
          workspace_name: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_panelist_kit: {
        Args: { p_reason?: string; target_kit_id: string }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
