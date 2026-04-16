import type { ReactNode } from "react";
import { useAtelierSession } from "../../hooks/useAtelierSession";
import MecanoSwitchModal from "./MecanoSwitchModal";

type Props = {
  children: ReactNode;
};

export default function RequireMecanoSession({ children }: Props) {
  const { isLoggedMecano } = useAtelierSession();

  return (
    <>
      {children}
      {!isLoggedMecano && <MecanoSwitchModal open={true} force />}
    </>
  );
}