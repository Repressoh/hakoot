"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

interface Step {
  _id: Id<"gameSteps">;
  choices?: Array<{ text: string; isCorrect: boolean }>;
  gameId: Id<"games">;
  markdownContent?: string;
  order: number;
  question?: string;
  timeLimitSeconds?: number;
  type: "theory" | "quiz";
}

interface Props {
  gameId: Id<"games">;
  steps: Step[];
}

interface SortableItemProps {
  gameId: Id<"games">;
  index: number;
  onDelete: (id: Id<"gameSteps">) => void;
  onMove: (id: Id<"gameSteps">, dir: "up" | "down") => void;
  step: Step;
  total: number;
}

function SortableStepItem({
  gameId,
  step,
  index,
  total,
  onDelete,
  onMove,
}: SortableItemProps) {
  const t = useTranslations("gameEditor");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-3.5 backdrop-blur-sm",
        step.type === "theory"
          ? "border-l-4 border-l-choice-blue/70"
          : "border-l-4 border-l-choice-yellow/70",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-black/10 hover:shadow-lg",
        isDragging &&
          "relative z-50 opacity-60 shadow-[0_0_20px_var(--glow-primary)]"
      )}
      ref={setNodeRef}
      style={style}
    >
      {/* Drag handle */}
      <button
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <svg
          aria-hidden="true"
          fill="currentColor"
          height="16"
          viewBox="0 0 16 16"
          width="16"
        >
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>

      {/* Step info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground text-xs">
            {t("stepOrder", { number: index + 1 })}
          </span>
          <Badge
            className={cn(
              "text-xs",
              step.type === "theory"
                ? "border-choice-blue/30 bg-choice-blue/15 text-choice-blue"
                : "border-choice-yellow/30 bg-choice-yellow/15 text-choice-yellow"
            )}
            variant="outline"
          >
            {step.type === "theory" ? "Theory" : "Quiz"}
          </Badge>
        </div>
        <p className="mt-0.5 truncate font-medium text-foreground text-sm">
          {step.type === "theory"
            ? step.markdownContent?.slice(0, 60) || "Empty theory step"
            : step.question || "Empty quiz step"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Arrow buttons for accessibility */}
        <Button
          aria-label={t("moveUp")}
          className="size-7 p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          disabled={index === 0}
          onClick={() => onMove(step._id, "up")}
          size="sm"
          variant="ghost"
        >
          ↑
        </Button>
        <Button
          aria-label={t("moveDown")}
          className="size-7 p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          disabled={index === total - 1}
          onClick={() => onMove(step._id, "down")}
          size="sm"
          variant="ghost"
        >
          ↓
        </Button>

        <Button
          asChild
          className="h-7 rounded-lg border-border text-foreground hover:bg-muted/50"
          size="sm"
          variant="outline"
        >
          <Link href={`/games/${gameId}/steps/${step._id}`}>
            {t("editStep")}
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              aria-label={t("deleteStep")}
              className="size-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              size="sm"
              variant="ghost"
            >
              ×
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="surface-elevated border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                Delete step?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border text-foreground hover:bg-muted/50">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => onDelete(step._id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

export function StepList({ gameId, steps }: Props) {
  const t = useTranslations("gameEditor");
  const removeStep = useMutation(api.steps.remove);
  const moveStepMut = useMutation(api.steps.move);
  const reorderStepsMut = useMutation(api.steps.reorder);
  const [localSteps, setLocalSteps] = useState<Step[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const displaySteps = isDragging ? localSteps : steps;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setIsDragging(false);
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = displaySteps.findIndex((s) => s._id === active.id);
    const newIndex = displaySteps.findIndex((s) => s._id === over.id);
    const reordered = arrayMove(displaySteps, oldIndex, newIndex);
    setLocalSteps(reordered);

    try {
      await reorderStepsMut({
        gameId,
        orderedIds: reordered.map((s) => s._id),
      });
    } catch {
      setLocalSteps(steps);
      toast.error("Failed to reorder");
    }
  }

  async function handleMove(stepId: Id<"gameSteps">, direction: "up" | "down") {
    try {
      await moveStepMut({ direction, stepId });
    } catch {
      toast.error("Failed to move step");
    }
  }

  async function handleDelete(stepId: Id<"gameSteps">) {
    try {
      await removeStep({ stepId });
      toast.success("Step deleted");
    } catch {
      toast.error("Failed to delete step");
    }
  }

  if (displaySteps.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        {t("noSteps")}
      </p>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragStart={() => {
        setLocalSteps(steps);
        setIsDragging(true);
      }}
      sensors={sensors}
    >
      <SortableContext
        items={displaySteps.map((s) => s._id)}
        strategy={verticalListSortingStrategy}
      >
        <ul aria-label="Game steps" className="m-0 list-none space-y-2 p-0">
          {displaySteps.map((step, i) => (
            <SortableStepItem
              gameId={gameId}
              index={i}
              key={step._id}
              onDelete={handleDelete}
              onMove={handleMove}
              step={step}
              total={displaySteps.length}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
