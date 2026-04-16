import { useState } from "react";
import { useAtelierSession } from "../../hooks/useAtelierSession";
import MecanoSwitchModal from "./MecanoSwitchModal";

export default function MecanoQuickSwitchFab() {
  const { mecanoNom } = useAtelierSession();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[120] rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-blue-700"
      >
        {mecanoNom ? `Mécano · ${mecanoNom}` : "Choisir mécano"}
      </button>

      <MecanoSwitchModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}