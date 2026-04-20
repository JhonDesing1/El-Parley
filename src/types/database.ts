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
      affiliate_clicks: {
        Row: {
          bookmaker_id: number
          clicked_at: string | null
          country: string | null
          id: number
          ip_hash: string | null
          match_id: number | null
          source: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          bookmaker_id: number
          clicked_at?: string | null
          country?: string | null
          id?: number
          ip_hash?: string | null
          match_id?: number | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          bookmaker_id?: number
          clicked_at?: string | null
          country?: string | null
          id?: number
          ip_hash?: string | null
          match_id?: number | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_bookmaker_id_fkey"
            columns: ["bookmaker_id"]
            isOneToOne: false
            referencedRelation: "bookmakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author: string | null
          category: string | null
          content: string
          cover_image: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          is_premium: boolean | null
          is_published: boolean | null
          published_at: string | null
          related_match_id: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
          views: number | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          content: string
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_premium?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          related_match_id?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          author?: string | null
          category?: string | null
          content?: string
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_premium?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          related_match_id?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_related_match_id_fkey"
            columns: ["related_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmakers: {
        Row: {
          affiliate_tag: string | null
          affiliate_url: string
          commission_model: string | null
          commission_value: number | null
          country: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          logo_url: string | null
          name: string
          priority: number | null
          slug: string
        }
        Insert: {
          affiliate_tag?: string | null
          affiliate_url: string
          commission_model?: string | null
          commission_value?: number | null
          country?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          priority?: number | null
          slug: string
        }
        Update: {
          affiliate_tag?: string | null
          affiliate_url?: string
          commission_model?: string | null
          commission_value?: number | null
          country?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          priority?: number | null
          slug?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          match_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          match_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          match_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          detail: string | null
          id: number
          match_id: number | null
          player_name: string
          player_photo: string | null
          reason: string | null
          team_id: number
          type: string | null
          updated_at: string | null
        }
        Insert: {
          detail?: string | null
          id?: number
          match_id?: number | null
          player_name: string
          player_photo?: string | null
          reason?: string | null
          team_id: number
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          detail?: string | null
          id?: number
          match_id?: number | null
          player_name?: string
          player_photo?: string | null
          reason?: string | null
          team_id?: number
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injuries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          country: string
          country_code: string | null
          created_at: string | null
          flag_url: string | null
          id: number
          is_featured: boolean | null
          logo_url: string | null
          name: string
          priority: number | null
          season: number
          slug: string
          type: string | null
        }
        Insert: {
          country: string
          country_code?: string | null
          created_at?: string | null
          flag_url?: string | null
          id: number
          is_featured?: boolean | null
          logo_url?: string | null
          name: string
          priority?: number | null
          season: number
          slug: string
          type?: string | null
        }
        Update: {
          country?: string
          country_code?: string | null
          created_at?: string | null
          flag_url?: string | null
          id?: number
          is_featured?: boolean | null
          logo_url?: string | null
          name?: string
          priority?: number | null
          season?: number
          slug?: string
          type?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_score: number | null
          away_score_ht: number | null
          away_team_id: number
          created_at: string | null
          home_score: number | null
          home_score_ht: number | null
          home_team_id: number
          id: number
          kickoff: string
          league_id: number
          minute: number | null
          model_away_prob: number | null
          model_draw_prob: number | null
          model_expected_goals_away: number | null
          model_expected_goals_home: number | null
          model_home_prob: number | null
          referee: string | null
          round: string | null
          season: number
          stats: Json | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_score_ht?: number | null
          away_team_id: number
          created_at?: string | null
          home_score?: number | null
          home_score_ht?: number | null
          home_team_id: number
          id: number
          kickoff: string
          league_id: number
          minute?: number | null
          model_away_prob?: number | null
          model_draw_prob?: number | null
          model_expected_goals_away?: number | null
          model_expected_goals_home?: number | null
          model_home_prob?: number | null
          referee?: string | null
          round?: string | null
          season: number
          stats?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_score_ht?: number | null
          away_team_id?: number
          created_at?: string | null
          home_score?: number | null
          home_score_ht?: number | null
          home_team_id?: number
          id?: number
          kickoff?: string
          league_id?: number
          minute?: number | null
          model_away_prob?: number | null
          model_draw_prob?: number | null
          model_expected_goals_away?: number | null
          model_expected_goals_home?: number | null
          model_home_prob?: number | null
          referee?: string | null
          round?: string | null
          season?: number
          stats?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author: string | null
          content: string | null
          created_at: string | null
          id: number
          image_url: string | null
          language: string | null
          published_at: string
          related_match_id: number | null
          related_team_ids: number[] | null
          source: string | null
          source_url: string | null
          summary: string | null
          title: string
        }
        Insert: {
          author?: string | null
          content?: string | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          language?: string | null
          published_at: string
          related_match_id?: number | null
          related_team_ids?: number[] | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          author?: string | null
          content?: string | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          language?: string | null
          published_at?: string
          related_match_id?: number | null
          related_team_ids?: number[] | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_related_match_id_fkey"
            columns: ["related_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_subscriptions: {
        Row: {
          created_at: string | null
          onesignal_player_id: string | null
          push_live_scores: boolean | null
          push_parlays: boolean | null
          push_value_bets: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          onesignal_player_id?: string | null
          push_live_scores?: boolean | null
          push_parlays?: boolean | null
          push_value_bets?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          onesignal_player_id?: string | null
          push_live_scores?: boolean | null
          push_parlays?: boolean | null
          push_value_bets?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      odds: {
        Row: {
          bookmaker_id: number
          id: number
          implied_prob: number | null
          is_live: boolean | null
          line: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          previous_price: number | null
          price: number
          selection: string
          updated_at: string
        }
        Insert: {
          bookmaker_id: number
          id?: number
          implied_prob?: number | null
          is_live?: boolean | null
          line?: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          previous_price?: number | null
          price: number
          selection: string
          updated_at?: string
        }
        Update: {
          bookmaker_id?: number
          id?: number
          implied_prob?: number | null
          is_live?: boolean | null
          line?: number | null
          market?: Database["public"]["Enums"]["market_type"]
          match_id?: number
          previous_price?: number | null
          price?: number
          selection?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odds_bookmaker_id_fkey"
            columns: ["bookmaker_id"]
            isOneToOne: false
            referencedRelation: "bookmakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      parlay_legs: {
        Row: {
          bookmaker_id: number | null
          id: number
          leg_order: number
          line: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          model_prob: number | null
          parlay_id: string
          price: number
          result: string | null
          selection: string
        }
        Insert: {
          bookmaker_id?: number | null
          id?: number
          leg_order: number
          line?: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          model_prob?: number | null
          parlay_id: string
          price: number
          result?: string | null
          selection: string
        }
        Update: {
          bookmaker_id?: number | null
          id?: number
          leg_order?: number
          line?: number | null
          market?: Database["public"]["Enums"]["market_type"]
          match_id?: number
          model_prob?: number | null
          parlay_id?: string
          price?: number
          result?: string | null
          selection?: string
        }
        Relationships: [
          {
            foreignKeyName: "parlay_legs_bookmaker_id_fkey"
            columns: ["bookmaker_id"]
            isOneToOne: false
            referencedRelation: "bookmakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parlay_legs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parlay_legs_parlay_id_fkey"
            columns: ["parlay_id"]
            isOneToOne: false
            referencedRelation: "parlays"
            referencedColumns: ["id"]
          },
        ]
      }
      parlays: {
        Row: {
          confidence: string | null
          created_at: string | null
          description: string | null
          expected_value: number | null
          id: string
          is_featured: boolean | null
          result_updated_at: string | null
          status: Database["public"]["Enums"]["parlay_status"]
          tier: Database["public"]["Enums"]["subscription_tier"]
          title: string
          total_odds: number
          total_probability: number
          valid_until: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          description?: string | null
          expected_value?: number | null
          id?: string
          is_featured?: boolean | null
          result_updated_at?: string | null
          status?: Database["public"]["Enums"]["parlay_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          title: string
          total_odds: number
          total_probability: number
          valid_until?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          description?: string | null
          expected_value?: number | null
          id?: string
          is_featured?: boolean | null
          result_updated_at?: string | null
          status?: Database["public"]["Enums"]["parlay_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          title?: string
          total_odds?: number
          total_probability?: number
          valid_until?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          api_key: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarded: boolean
          roi_30d: number | null
          roi_7d: number | null
          telegram_chat_id: string | null
          tg_value_bets: boolean
          tg_results: boolean
          tg_parlays: boolean
          tier: Database["public"]["Enums"]["subscription_tier"]
          timezone: string | null
          total_picks: number | null
          updated_at: string
          username: string | null
          win_rate: number | null
        }
        Insert: {
          api_key?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarded?: boolean
          roi_30d?: number | null
          roi_7d?: number | null
          telegram_chat_id?: string | null
          tg_value_bets?: boolean
          tg_results?: boolean
          tg_parlays?: boolean
          tier?: Database["public"]["Enums"]["subscription_tier"]
          timezone?: string | null
          total_picks?: number | null
          updated_at?: string
          username?: string | null
          win_rate?: number | null
        }
        Update: {
          api_key?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarded?: boolean
          roi_30d?: number | null
          roi_7d?: number | null
          telegram_chat_id?: string | null
          tg_value_bets?: boolean
          tg_results?: boolean
          tg_parlays?: boolean
          tier?: Database["public"]["Enums"]["subscription_tier"]
          timezone?: string | null
          total_picks?: number | null
          updated_at?: string
          username?: string | null
          win_rate?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          country: string | null
          created_at: string | null
          founded: number | null
          id: number
          logo_url: string | null
          name: string
          short_name: string | null
          slug: string
          venue: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          founded?: number | null
          id: number
          logo_url?: string | null
          name: string
          short_name?: string | null
          slug: string
          venue?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          founded?: number | null
          id?: number
          logo_url?: string | null
          name?: string
          short_name?: string | null
          slug?: string
          venue?: string | null
        }
        Relationships: []
      }
      user_parlay_legs: {
        Row: {
          bookmaker_id: number | null
          id: number
          leg_order: number
          line: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          price: number
          result: string | null
          selection: string
          user_parlay_id: string
        }
        Insert: {
          bookmaker_id?: number | null
          id?: number
          leg_order: number
          line?: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          price: number
          result?: string | null
          selection: string
          user_parlay_id: string
        }
        Update: {
          bookmaker_id?: number | null
          id?: number
          leg_order?: number
          line?: number | null
          market?: Database["public"]["Enums"]["market_type"]
          match_id?: number
          price?: number
          result?: string | null
          selection?: string
          user_parlay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_parlay_legs_bookmaker_id_fkey"
            columns: ["bookmaker_id"]
            isOneToOne: false
            referencedRelation: "bookmakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_parlay_legs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_parlay_legs_user_parlay_id_fkey"
            columns: ["user_parlay_id"]
            isOneToOne: false
            referencedRelation: "user_parlays"
            referencedColumns: ["id"]
          },
        ]
      }
      user_parlays: {
        Row: {
          created_at: string | null
          id: string
          is_public: boolean | null
          name: string | null
          potential_return: number | null
          stake: number | null
          status: Database["public"]["Enums"]["parlay_status"] | null
          total_odds: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name?: string | null
          potential_return?: number | null
          stake?: number | null
          status?: Database["public"]["Enums"]["parlay_status"] | null
          total_odds: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name?: string | null
          potential_return?: number | null
          stake?: number | null
          status?: Database["public"]["Enums"]["parlay_status"] | null
          total_odds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_parlays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_parlays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_picks: {
        Row: {
          bookmaker_id: number | null
          created_at: string
          id: string
          line: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          notes: string | null
          odds: number
          profit_loss: number | null
          resolved_at: string | null
          result: Database["public"]["Enums"]["pick_result"]
          selection: string
          stake: number | null
          user_id: string
          value_bet_id: number | null
        }
        Insert: {
          bookmaker_id?: number | null
          created_at?: string
          id?: string
          line?: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          notes?: string | null
          odds: number
          profit_loss?: number | null
          resolved_at?: string | null
          result?: Database["public"]["Enums"]["pick_result"]
          selection: string
          stake?: number | null
          user_id: string
          value_bet_id?: number | null
        }
        Update: {
          bookmaker_id?: number | null
          created_at?: string
          id?: string
          line?: number | null
          market?: Database["public"]["Enums"]["market_type"]
          match_id?: number
          notes?: string | null
          odds?: number
          profit_loss?: number | null
          resolved_at?: string | null
          result?: Database["public"]["Enums"]["pick_result"]
          selection?: string
          stake?: number | null
          user_id?: string
          value_bet_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_picks_bookmaker_id_fkey"
            columns: ["bookmaker_id"]
            isOneToOne: false
            referencedRelation: "bookmakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_picks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_picks_value_bet_id_fkey"
            columns: ["value_bet_id"]
            isOneToOne: false
            referencedRelation: "value_bets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_webhooks: {
        Row: {
          created_at: string
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_triggered_at: string | null
          secret: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          secret: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_webhooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_webhooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      value_bets: {
        Row: {
          bookmaker_id: number
          confidence: string | null
          detected_at: string | null
          edge: number
          id: number
          implied_prob: number
          is_premium: boolean | null
          is_suggested: boolean
          kelly_fraction: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          model_prob: number
          price: number
          reasoning: string | null
          result: string | null
          selection: string
        }
        Insert: {
          bookmaker_id: number
          confidence?: string | null
          detected_at?: string | null
          edge: number
          id?: number
          implied_prob: number
          is_premium?: boolean | null
          is_suggested?: boolean
          kelly_fraction?: number | null
          market: Database["public"]["Enums"]["market_type"]
          match_id: number
          model_prob: number
          price: number
          reasoning?: string | null
          result?: string | null
          selection: string
        }
        Update: {
          bookmaker_id?: number
          confidence?: string | null
          detected_at?: string | null
          edge?: number
          id?: number
          implied_prob?: number
          is_premium?: boolean | null
          is_suggested?: boolean
          kelly_fraction?: number | null
          market?: Database["public"]["Enums"]["market_type"]
          match_id?: number
          model_prob?: number
          price?: number
          reasoning?: string | null
          result?: string | null
          selection?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_bets_bookmaker_id_fkey"
            columns: ["bookmaker_id"]
            isOneToOne: false
            referencedRelation: "bookmakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      tipster_picks: {
        Row: {
          id: number
          tipster_name: string
          match_id: number | null
          match_label: string | null
          league_label: string | null
          kickoff: string | null
          market: string
          selection: string
          odds: number
          stake_units: number | null
          result: Database["public"]["Enums"]["pick_result"]
          profit_units: number | null
          published: boolean
          reasoning: string | null
          notes: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: number
          tipster_name?: string
          match_id?: number | null
          match_label?: string | null
          league_label?: string | null
          kickoff?: string | null
          market: string
          selection: string
          odds: number
          stake_units?: number | null
          result?: Database["public"]["Enums"]["pick_result"]
          profit_units?: number | null
          published?: boolean
          reasoning?: string | null
          notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: number
          tipster_name?: string
          match_id?: number | null
          match_label?: string | null
          league_label?: string | null
          kickoff?: string | null
          market?: string
          selection?: string
          odds?: number
          stake_units?: number | null
          result?: Database["public"]["Enums"]["pick_result"]
          profit_units?: number | null
          published?: boolean
          reasoning?: string | null
          notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tipster_picks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          country: string | null
          id: string | null
          picks_30d: number | null
          rank: number | null
          refreshed_at: string | null
          roi_30d: number | null
          roi_7d: number | null
          score: number | null
          streak: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          total_picks: number | null
          username: string | null
          win_rate: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_matches_today: {
        Args: { p_date?: string }
        Returns: {
          away_logo: string
          away_score: number
          away_team: string
          best_away_book: string
          best_away_odd: number
          best_draw_book: string
          best_draw_odd: number
          best_home_book: string
          best_home_odd: number
          has_value_bet: boolean
          home_logo: string
          home_score: number
          home_team: string
          kickoff: string
          league_logo: string
          league_name: string
          match_id: number
          status: Database["public"]["Enums"]["match_status"]
        }[]
      }
      is_premium: { Args: { uid: string }; Returns: boolean }
      recalc_tipster_stats: { Args: { p_user_id: string }; Returns: undefined }
      refresh_leaderboard: { Args: never; Returns: undefined }
      register_pick: {
        Args: {
          p_bookmaker_id?: number
          p_line?: number
          p_market: Database["public"]["Enums"]["market_type"]
          p_match_id: number
          p_notes?: string
          p_odds: number
          p_selection: string
          p_stake?: number
          p_value_bet_id?: number
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      market_type:
        | "1x2"
        | "double_chance"
        | "over_under_2_5"
        | "over_under_1_5"
        | "btts"
        | "correct_score"
        | "asian_handicap"
        | "draw_no_bet"
      match_status: "scheduled" | "live" | "finished" | "postponed" | "canceled"
      parlay_status: "pending" | "won" | "lost" | "void" | "partial"
      pick_result: "pending" | "won" | "lost" | "void"
      subscription_status:
        | "active"
        | "canceled"
        | "past_due"
        | "trialing"
        | "incomplete"
      subscription_tier: "free" | "premium" | "pro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
    Enums: {
      market_type: [
        "1x2",
        "double_chance",
        "over_under_2_5",
        "over_under_1_5",
        "btts",
        "correct_score",
        "asian_handicap",
        "draw_no_bet",
      ],
      match_status: ["scheduled", "live", "finished", "postponed", "canceled"],
      parlay_status: ["pending", "won", "lost", "void", "partial"],
      pick_result: ["pending", "won", "lost", "void"],
      subscription_status: [
        "active",
        "canceled",
        "past_due",
        "trialing",
        "incomplete",
      ],
      subscription_tier: ["free", "premium", "pro"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
