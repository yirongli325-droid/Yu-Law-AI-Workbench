import { WorkbenchShell } from "./_components/WorkbenchShell";
import { tools } from "../lib/tool-registry";

export default function Home() {
  return <WorkbenchShell tools={tools} />;
}
