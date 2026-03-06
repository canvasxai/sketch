import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string | null;
  onConfirm: () => void;
}

export function DeleteSkillDialog({ open, onOpenChange, skillName, onConfirm }: DeleteSkillDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Delete &lsquo;{skillName}&rsquo;?</DialogTitle>
          <DialogDescription className="text-sm">
            This skill will be permanently removed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
