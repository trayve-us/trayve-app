/**
 * CreditsDisplay Component
 * Shows user's credit balance in the top-right corner
 * Matches the design from main Trayve app
 */

import { useState, useEffect } from "react";
import { Badge, Button, Tooltip } from "@shopify/polaris";
import { useFetcher, useNavigate } from "@remix-run/react";

interface CreditBalance {
  user_id: string;
  shop_domain: string;
  total_credits: number;
  used_credits: number;
  available_credits: number;
  updated_at: string;
  plan?: string; // Add plan information
}

export function CreditsDisplay() {
  const fetcher = useFetcher<{
    success: boolean;
    user_id?: string;
    shop_domain?: string;
    total_credits?: number;
    used_credits?: number;
    available_credits?: number;
    updated_at?: string;
    error?: string;
  }>();
  const navigate = useNavigate();

  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch credits on mount
  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/api/credits/balance");
    }
  }, []);

  // Update credits when fetcher returns data
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.user_id) {
      setCredits({
        user_id: fetcher.data.user_id,
        shop_domain: fetcher.data.shop_domain || "",
        total_credits: fetcher.data.total_credits || 0,
        used_credits: fetcher.data.used_credits || 0,
        available_credits: fetcher.data.available_credits || 0,
        updated_at: fetcher.data.updated_at || "",
      });
      setLoading(false);
    } else if (fetcher.data?.error) {
      console.error("Failed to fetch credits:", fetcher.data.error);
      setLoading(false);
    }
  }, [fetcher.data]);

  // Refresh credits every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetcher.load("/api/credits/balance");
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(interval);
  }, []);

  const formatCredits = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  };

  const availableCredits = credits?.available_credits || 0;
  const currentPlan = credits?.plan || "Free Plan";
  const currentCycleCredits = credits?.total_credits || 0;
  const rolloverCredits = 0; // This would come from API if you track rollover

  if (loading && !credits) {
    return (
      <div style={{ 
        width: "80px", 
        height: "28px", 
        background: "rgba(0, 0, 0, 0.05)",
        borderRadius: "4px",
        animation: "pulse 1.5s ease-in-out infinite"
      }} />
    );
  }

  if (!credits && !loading) {
    return (
      <Button
        url="/pricing"
        size="slim"
      >
        Get Credits
      </Button>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: "8px",
      position: "relative",
    }}>
      <div 
        style={{
          padding: "4px 12px",
          backgroundColor: "rgba(112, 45, 255, 0.1)",
          border: "none",
          borderRadius: "100px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          const tooltip = e.currentTarget.querySelector('.credits-tooltip') as HTMLElement;
          if (tooltip) tooltip.style.display = 'block';
        }}
        onMouseLeave={(e) => {
          const tooltip = e.currentTarget.querySelector('.credits-tooltip') as HTMLElement;
          if (tooltip) tooltip.style.display = 'none';
        }}
      >
        <span style={{ 
          fontWeight: "600",
          color: "#702dff",
          fontSize: "14px"
        }}>
          {formatCredits(availableCredits)}
        </span>
        
        {/* Custom Detailed Popup */}
        <div 
          className="credits-tooltip"
          style={{
            display: "none",
            position: "absolute",
            top: "calc(100% + 12px)",
            right: "0",
            backgroundColor: "white",
            borderRadius: "12px",
            fontSize: "14px",
            whiteSpace: "nowrap",
            zIndex: 10000,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            border: "1px solid #E1E3E5",
            minWidth: "320px",
            padding: "20px",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}>
            <h3 style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#202223",
              margin: 0,
            }}>
              Current Plan
            </h3>
            <span style={{
              padding: "4px 12px",
              backgroundColor: "#f3f4f6",
              color: "#6b7280",
              borderRadius: "100px",
              fontSize: "13px",
              fontWeight: "500",
            }}>
              {currentPlan}
            </span>
          </div>

          {/* Credits Section */}
          <div style={{ marginBottom: "16px" }}>
            <h4 style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#202223",
              margin: "0 0 12px 0",
            }}>
              Your Available Credits
            </h4>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "12px",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
              }}>
                <span style={{ color: "#6b7280" }}>Current billing cycle</span>
                <span style={{ color: "#202223", fontWeight: "500" }}>
                  {currentCycleCredits} credits
                </span>
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
              }}>
                <span style={{ color: "#6b7280" }}>Rollover from previous cycles</span>
                <span style={{ color: "#202223", fontWeight: "500" }}>
                  {rolloverCredits} credits
                </span>
              </div>
            </div>

            <div style={{
              paddingTop: "12px",
              borderTop: "1px solid #E1E3E5",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
            }}>
              <span style={{ color: "#202223", fontWeight: "600" }}>
                Total available credits
              </span>
              <span style={{ color: "#202223", fontWeight: "700" }}>
                {availableCredits} credits
              </span>
            </div>
          </div>

          {/* Upgrade Button */}
          <button
            onClick={() => navigate("/app/pricing")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "12px",
              backgroundColor: "#702dff",
              color: "white",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              transition: "all 0.2s ease",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#5c24cc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#702dff";
            }}
          >
            Upgrade your plan
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </button>

          {/* Tooltip arrow */}
          <div style={{
            position: "absolute",
            bottom: "100%",
            right: "20px",
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderBottom: "8px solid white",
          }} />
          <div style={{
            position: "absolute",
            bottom: "calc(100% + 1px)",
            right: "21px",
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderBottom: "7px solid white",
          }} />
        </div>
      </div>

      {availableCredits <= 100 && (
        <Button
          url="/pricing"
          size="slim"
          tone="success"
        >
          + Add
        </Button>
      )}
    </div>
  );
}

// Export function to refresh credits display
export function refreshCredits() {
  // Trigger a custom event that components can listen to
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("refresh-credits"));
  }
}
