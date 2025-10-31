import { useFetcher } from "@remix-run/react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { ConfirmationDialog } from "./ui/confirmation-dialog";
import { AlertDialog } from "./ui/alert-dialog";

interface TestingPanelProps {
  currentCredits: number;
}

interface ResetResponse {
  success?: boolean;
  error?: string;
  message?: string;
  credits?: {
    total: number;
    available: number;
    used: number;
  };
}

export function TestingPanel({ currentCredits }: TestingPanelProps) {
  const fetcher = useFetcher<ResetResponse>();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: "", description: "" });

  const isResetting = fetcher.state === "submitting" || fetcher.state === "loading";

  // Handle reset confirmation
  const handleResetConfirm = () => {
    fetcher.submit(
      {},
      {
        method: "POST",
        action: "/api/testing/reset",
      }
    );
    setConfirmDialogOpen(false);
  };

  // Show success/error alert after reset
  if (fetcher.data && fetcher.state === "idle") {
    if (!alertDialogOpen) {
      if (fetcher.data.success) {
        setAlertMessage({
          title: "Reset Successful",
          description: "Your account has been reset to true free tier with 0 credits. Premium models are now locked. Please refresh the page to see changes.",
        });
        setAlertDialogOpen(true);
      } else if (fetcher.data.error) {
        setAlertMessage({
          title: "Reset Failed",
          description: fetcher.data.error,
        });
        setAlertDialogOpen(true);
      }
    }
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          backgroundColor: "#FEF3C7",
          border: "2px solid #F59E0B",
          borderRadius: "12px",
          padding: "16px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          zIndex: 9999,
          maxWidth: "320px",
        }}
      >
        <div style={{ display: "flex", alignItems: "start", gap: "12px", marginBottom: "12px" }}>
          <AlertTriangle size={20} color="#D97706" />
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#92400E",
                marginBottom: "4px",
              }}
            >
              Testing Mode Active
            </h3>
            <p style={{ fontSize: "12px", color: "#78350F", lineHeight: "1.4" }}>
              Current Credits: <strong>{currentCredits.toLocaleString()}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => setConfirmDialogOpen(true)}
          disabled={isResetting}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "#F59E0B",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: isResetting ? "not-allowed" : "pointer",
            opacity: isResetting ? 0.6 : 1,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!isResetting) {
              e.currentTarget.style.backgroundColor = "#D97706";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#F59E0B";
          }}
        >
          <RefreshCw size={16} className={isResetting ? "animate-spin" : ""} />
          {isResetting ? "Resetting..." : "Reset to Fresh State"}
        </button>

        <p
          style={{
            fontSize: "11px",
            color: "#78350F",
            marginTop: "8px",
            lineHeight: "1.3",
          }}
        >
          Resets credits to 0, clears subscriptions, sets to true free tier
        </p>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleResetConfirm}
        title="Reset Account Data"
        description="This will reset your credits to 0 (true free tier), clear all subscriptions, and set your tier to free. Your projects will be preserved. This allows you to test the free plan experience with locked premium models."
        confirmText="Reset"
        cancelText="Cancel"
        variant="default"
        isLoading={isResetting}
      />

      {/* Alert Dialog */}
      <AlertDialog
        open={alertDialogOpen}
        onOpenChange={(open) => {
          setAlertDialogOpen(open);
          if (!open && fetcher.data?.success) {
            // Reload page after successful reset
            window.location.reload();
          }
        }}
        title={alertMessage.title}
        description={alertMessage.description}
        variant={fetcher.data?.success ? "success" : "error"}
      />

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
}
