/**
 * Tipos de la base de datos (equivalentes a `supabase gen types typescript`).
 * Si cambias el SQL, actualiza también este archivo.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GameStatus = "REGISTRATION_OPEN" | "ASSIGNING" | "ASSIGNED";
export type AssignmentSource = "EXISTING" | "GENERATED";
export type LoginScope = "participant" | "admin";

export type GameSettingsRow = {
  id: number;
  expected_participants: number | null;
  status: GameStatus;
  assignments_locked: boolean;
  allow_wishlist_edit_after_lock: boolean;
  assignment_started_at: string | null;
  assignment_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ParticipantRow = {
  id: string;
  name: string;
  name_normalized: string;
  student_code: string;
  wishlist: string;
  has_existing_assignment: boolean;
  reported_target_name: string | null;
  reported_target_id: string | null;
  reported_target_confirmed: boolean;
  created_at: string;
  updated_at: string;
};

export type AssignmentRow = {
  id: string;
  giver_id: string;
  receiver_id: string;
  source: AssignmentSource;
  created_at: string;
};

export type LoginAttemptRow = {
  id: number;
  scope: LoginScope;
  client_key: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      game_settings: {
        Row: GameSettingsRow;
        Insert: Partial<GameSettingsRow>;
        Update: Partial<Omit<GameSettingsRow, "id" | "created_at">>;
        Relationships: [];
      };
      participants: {
        Row: ParticipantRow;
        Insert: {
          id?: string;
          name: string;
          name_normalized: string;
          student_code: string;
          wishlist?: string;
          has_existing_assignment?: boolean;
          reported_target_name?: string | null;
          reported_target_id?: string | null;
          reported_target_confirmed?: boolean;
        };
        Update: Partial<Omit<ParticipantRow, "id" | "created_at" | "updated_at">>;
        Relationships: [
          {
            foreignKeyName: "participants_reported_target_id_fkey";
            columns: ["reported_target_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
        ];
      };
      assignments: {
        Row: AssignmentRow;
        Insert: {
          id?: string;
          giver_id: string;
          receiver_id: string;
          source: AssignmentSource;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "assignments_giver_id_fkey";
            columns: ["giver_id"];
            isOneToOne: true;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_receiver_id_fkey";
            columns: ["receiver_id"];
            isOneToOne: true;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
        ];
      };
      login_attempts: {
        Row: LoginAttemptRow;
        Insert: { scope: LoginScope; client_key: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      commit_assignments: {
        Args: { p_participant_ids: string[]; p_assignments: Json };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
