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

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  buttonText?: string;
  variant?: "default" | "error" | "success" | "info" | "warning";
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  buttonText = "OK",
  variant = "default",
}) => {
  const getIcon = () => {
    switch (variant) {
      case "error":
        return <XCircle className="h-6 w-6 text-red-600" />;
      case "success":
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case "info":
        return <Info className="h-6 w-6 text-blue-600" />;
      case "warning":
        return <AlertTriangle className="h-6 w-6 text-amber-600" />;
      default:
        return <Info className="h-6 w-6 text-gray-600" />;
    }
  };

  const getButtonStyles = () => {
    const base =
      "px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
    
    switch (variant) {
      case "error":
        return `${base} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`;
      case "success":
        return `${base} bg-green-600 text-white hover:bg-green-700 focus:ring-green-500`;
      case "info":
        return `${base} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`;
      case "warning":
        return `${base} bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500`;
      default:
        return `${base} bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500`;
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
            className={getButtonStyles()}
          >
            {buttonText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { AlertDialog };
