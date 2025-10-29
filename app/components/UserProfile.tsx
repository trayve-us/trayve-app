/**
 * UserProfile Component
 * Shows user profile dropdown with shop info and actions
 */

import { useState } from "react";
import { User, MessageCircle, HelpCircle } from "lucide-react";

interface UserProfileProps {
  email: string;
  shopName: string;
}

export function UserProfile({ email, shopName }: UserProfileProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: "2px solid #E1E3E5",
          backgroundColor: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#702dff";
          e.currentTarget.style.backgroundColor = "#f9fafb";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#E1E3E5";
          e.currentTarget.style.backgroundColor = "white";
        }}
      >
        <User size={20} color="#6b7280" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: "0",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            border: "1px solid #E1E3E5",
            minWidth: "280px",
            padding: "16px",
            zIndex: 10000,
          }}
        >
          {/* User Info Section */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingBottom: "16px",
              borderBottom: "1px solid #E1E3E5",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={24} color="#6b7280" />
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#202223",
                  margin: "0 0 4px 0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {shopName}
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email}
              </p>
            </div>
          </div>

          {/* Menu Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <a
              href="mailto:support@trayve.com"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                textDecoration: "none",
                color: "#202223",
                fontSize: "14px",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f9fafb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <MessageCircle size={18} color="#6b7280" />
              <span>Contact us</span>
            </a>

            <a
              href="https://docs.trayve.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                textDecoration: "none",
                color: "#202223",
                fontSize: "14px",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f9fafb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <HelpCircle size={18} color="#6b7280" />
              <span>Tutorials & resources</span>
            </a>
          </div>

          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              top: "-8px",
              right: "12px",
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: "8px solid white",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "-9px",
              right: "13px",
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderBottom: "7px solid #E1E3E5",
            }}
          />
        </div>
      )}
    </div>
  );
}
