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
import { Link, useRouter } from "@/i18n/routing";
import { deleteStep, moveStep, reorderSteps } from "@/lib/actions/step";
import type { GameStep } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface Props {
  gameId: string;
  steps: GameStep[];
}

interface SortableItemProps {
  gameId: string;
  index: number;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  step: GameStep;
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
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/50 bg-white p-3 shadow-sm",
        step.type === "theory"
          ? "border-l-4 border-l-blue-400"
          : "border-l-4 border-l-amber-400",
        "transition-all hover:shadow-md",
        isDragging && "relative z-50 opacity-50 shadow-lg"
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
            className="text-xs"
            variant={step.type === "theory" ? "secondary" : "default"}
          >
            {step.type === "theory" ? "Theory" : "Quiz"}
          </Badge>
        </div>
        <p className="mt-0.5 truncate font-medium text-sm">
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
          className="h-7 w-7 p-0"
          disabled={index === 0}
          onClick={() => onMove(step.id, "up")}
          size="sm"
          variant="ghost"
        >
          ↑
        </Button>
        <Button
          aria-label={t("moveDown")}
          className="h-7 w-7 p-0"
          disabled={index === total - 1}
          onClick={() => onMove(step.id, "down")}
          size="sm"
          variant="ghost"
        >
          ↓
        </Button>

        <Button asChild className="h-7" size="sm" variant="outline">
          <Link href={`/games/${gameId}/steps/${step.id}`}>
            {t("editStep")}
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              aria-label={t("deleteStep")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              size="sm"
              variant="ghost"
            >
              ×
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete step?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete(step.id)}
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

export function StepList({ gameId, steps: initialSteps }: Props) {
  const t = useTranslations("gameEditor");
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(steps, oldIndex, newIndex);
    setSteps(reordered);

    try {
      await reorderSteps(
        gameId,
        reordered.map((s) => s.id)
      );
    } catch {
      setSteps(initialSteps);
      toast.error("Failed to reorder");
    }
  }

  async function handleMove(stepId: string, direction: "up" | "down") {
    try {
      await moveStep(stepId, direction);
      router.refresh();
    } catch {
      toast.error("Failed to move step");
    }
  }

  async function handleDelete(stepId: string) {
    try {
      await deleteStep(stepId);
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
      toast.success("Step deleted");
    } catch {
      toast.error("Failed to delete step");
    }
  }

  if (steps.length === 0) {
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
      sensors={sensors}
    >
      <SortableContext
        items={steps.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul aria-label="Game steps" className="m-0 list-none space-y-2 p-0">
          {steps.map((step, i) => (
            <SortableStepItem
              gameId={gameId}
              index={i}
              key={step.id}
              onDelete={handleDelete}
              onMove={handleMove}
              step={step}
              total={steps.length}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
