"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Info } from "lucide-react";

type MessageType = "success" | "error" | "info";

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: MessageType;
  title: string;
  message: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const MessageModal = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  autoClose = true,
  autoCloseDelay = 3000,
}: MessageModalProps) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case "error":
        return <XCircle className="h-8 w-8 text-red-500" />;
      case "info":
        return <Info className="h-8 w-8 text-blue-500" />;
    }
  };

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950";
      case "error":
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950";
      case "info":
        return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`mx-4 max-w-sm sm:max-w-md ${getTypeStyles()}`}>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-2 sm:mb-3">{getIcon()}</div>
          <DialogTitle className="text-lg sm:text-xl font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base mt-1 sm:mt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center mt-3 sm:mt-4">
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessageModal;
