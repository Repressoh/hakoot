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
import { type ComponentProps, lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/routing";
import { useLazyOpen } from "@/lib/use-lazy-open";
import { cn } from "@/lib/utils";

// The confirmation dialog (Radix, focus trapping, scroll locking) loads after
// the list shows, keeping it out of the editor's initial JavaScript; until then
// the delete buttons are shown without it.
const DeleteStepDialog = lazy(() =>
  import("./delete-step-dialog").then((mod) => ({
    default: mod.DeleteStepDialog,
  }))
);

/** One row of the step list: the step's type and the start of its content. */
export interface StepSummary {
  _id: Id<"gameSteps">;
  preview: string;
  type: "theory" | "quiz";
}

interface Props {
  gameId: Id<"games">;
  steps: StepSummary[];
}

interface SortableItemProps {
  gameId: Id<"games">;
  index: number;
  onDelete: (id: Id<"gameSteps">) => void;
  onMove: (id: Id<"gameSteps">, dir: "up" | "down") => void;
  step: StepSummary;
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

  const deleteDialog = useLazyOpen();
  const deleteButton = (props?: ComponentProps<typeof Button>) => (
    <Button
      aria-label={t("deleteStep")}
      className="size-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      size="sm"
      variant="ghost"
      {...props}
    >
      ×
    </Button>
  );

  // No backdrop blur on cards in scrolling lists: behind their mostly opaque
  // background it made no visible difference, and on phones it left blank
  // tiles on screen during fast scrolls.
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-3.5",
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
          {step.preview ||
            (step.type === "theory" ? "Empty theory step" : "Empty quiz step")}
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

        <Suspense fallback={deleteButton(deleteDialog.placeholderProps)}>
          <DeleteStepDialog
            defaultOpen={deleteDialog.defaultOpen}
            onConfirm={() => onDelete(step._id)}
          >
            {deleteButton()}
          </DeleteStepDialog>
        </Suspense>
      </div>
    </li>
  );
}

/** A game's steps in order, with drag-and-drop reordering, move up/down and delete. */
export function StepList({ gameId, steps }: Props) {
  const t = useTranslations("gameEditor");
  const removeStep = useMutation(api.steps.remove);
  const moveStepMut = useMutation(api.steps.move);
  const reorderStepsMut = useMutation(api.steps.reorder);
  const [localSteps, setLocalSteps] = useState<StepSummary[]>([]);
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
