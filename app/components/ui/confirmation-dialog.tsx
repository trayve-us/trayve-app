import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "success" | "info";
  isLoading?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      case "success":
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case "info":
        return <Info className="h-6 w-6 text-blue-600" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-gray-600" />;
    }
  };

  const getConfirmButtonStyles = () => {
    const base =
      "px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
    
    switch (variant) {
      case "destructive":
        return `${base} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed`;
      case "success":
        return `${base} bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed`;
      case "info":
        return `${base} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`;
      default:
        return `${base} bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
            <div className="flex-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="px-4 py-2 rounded-md font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={getConfirmButtonStyles()}
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { ConfirmationDialog };
