import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const BUCKET = "factures-fournisseurs";

export function useFacturesFolder() {
  const [rootHandle, setRootHandle] = useState<any>(null);
  const [localRefs, setLocalRefs] = useState<any>({});

  function clean(name: string) {
    return name.replace(/\s+/g, "_");
  }

  async function chooseFolder() {
    const handle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
    });

    setRootHandle(handle);
    await scan(handle);
  }

  async function scan(handle: any) {
    const refs: any = {};

    for await (const [fournisseurName, fournisseurHandle] of handle.entries()) {
      if (fournisseurHandle.kind !== "directory") continue;

      for await (const [fileName, fileHandle] of fournisseurHandle.entries()) {
        if (!fileName.toLowerCase().endsWith(".pdf")) continue;

        const file = await fileHandle.getFile();
        const fournisseur = fournisseurName;

        const storagePath = `${new Date().getFullYear()}/${clean(
          fournisseur
        )}/${Date.now()}_${clean(fileName)}`;

        await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { upsert: false });

        await supabase.from("factures_fournisseurs").insert({
          fournisseur,
          nom_fichier: fileName,
          chemin_local_original: `${fournisseur}/${fileName}`,
          chemin_local_actuel: `${fournisseur}/${fileName}`,
          storage_path: storagePath,
          statut: "a_traiter",
          fichier_taille: file.size,
          fichier_last_modified: file.lastModified,
        });

        refs[`${fournisseur}/${fileName}`] = {
          file,
          fournisseurHandle,
        };
      }
    }

    setLocalRefs(refs);
  }

  return {
    chooseFolder,
    rootHandle,
    localRefs,
  };
}