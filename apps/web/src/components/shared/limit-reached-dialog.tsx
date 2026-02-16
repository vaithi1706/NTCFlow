"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface LimitReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: string;
  current: number;
  max: number;
}

export function LimitReachedDialog({ open, onOpenChange, limitType, current, max }: LimitReachedDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle className="text-center text-white">
            {limitType} Limit Reached
          </DialogTitle>
        </DialogHeader>
        <div className="text-center text-zinc-400 text-sm space-y-2">
          <p>
            You&apos;ve reached the limit of <span className="font-semibold text-white">{max} {limitType.toLowerCase()}</span> on the Free plan.
          </p>
          <p>Currently using: <span className="font-semibold text-white">{current}/{max}</span></p>
          <p>Upgrade to Pro for unlimited {limitType.toLowerCase()}.</p>
        </div>
        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-700">
            Cancel
          </Button>
          <Button
            onClick={() => { onOpenChange(false); router.push("/pricing"); }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
