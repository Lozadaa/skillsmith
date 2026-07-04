"use client";

import { useWizard } from "@/components/wizard/useWizard";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { StepIntent } from "@/components/wizard/StepIntent";
import { StepArchetype } from "@/components/wizard/StepArchetype";
import { StepDescription } from "@/components/wizard/StepDescription";
import { StepContent } from "@/components/wizard/StepContent";
import { StepReview } from "@/components/wizard/StepReview";
import { canAdvance } from "@/lib/wizard/state";

export default function NewSkillPage() {
  const [state, dispatch] = useWizard();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-neutral-100">
      <h1 className="text-xl font-semibold">Create a skill</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Answer a few questions and Skillsmith assembles a spec-compliant skill.
      </p>

      <div className="mt-6">
        <StepIndicator step={state.step} />
      </div>

      <div className="mt-8">
        {state.step === 1 && <StepIntent state={state} dispatch={dispatch} />}
        {state.step === 2 && <StepArchetype state={state} dispatch={dispatch} />}
        {state.step === 3 && <StepDescription state={state} dispatch={dispatch} />}
        {state.step === 4 && <StepContent state={state} dispatch={dispatch} />}
        {state.step === 5 && <StepReview state={state} />}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-neutral-800 pt-6">
        <button
          type="button"
          onClick={() => dispatch({ type: "back" })}
          disabled={state.step === 1}
          className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        {state.step < 5 && (
          <button
            type="button"
            onClick={() => dispatch({ type: "next" })}
            disabled={!canAdvance(state)}
            className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}
