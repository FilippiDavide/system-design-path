import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON } from "../primitives";

/**
 * The partial-failure question in one picture: after a timeout the
 * client cannot tell which of three things happened.
 */
export function TimeoutQuestion() {
  return (
    <Figure
      label="FIG 06"
      title="the timeout question"
      caption="A timeout is not a 'no'. The request may have been lost, executed with the reply lost, or still be in flight. Only the server knows, and the client cannot ask it without another request that can also time out."
    >
      <Canvas w={780} h={250}>
        <Box x={30} y={90} w={120} h={60} title="Client" />
        <Box x={630} y={90} w={120} h={60} title="Service" />

        <Arrow pts={[150, 108, 630, 108]} label="request" labelOffset={-10} />
        <Arrow pts={[630, 132, 150, 132]} dashed color="soft" label="response?" labelOffset={14} />

        {/* The three possibilities */}
        <circle cx={330} cy={108} r={5} fill={NEON.orange} />
        <Label x={330} y={60} lines={"1 · lost on the way\nnever executed"} size={10} mono color={NEON.orange} />
        <circle cx={690} cy={120} r={5} fill={NEON.magenta} />
        <Label x={690} y={185} lines={"2 · executed,\nreply lost"} size={10} mono color={NEON.magenta} />
        <circle cx={450} cy={132} r={5} fill={NEON.blue} />
        <Label x={450} y={185} lines={"3 · still running,\nslower than the timeout"} size={10} mono color={NEON.blue} />

        <Box x={30} y={190} w={120} h={44} title="Retry safe?" accent="var(--bad)" titleSize={12} />
        <Arrow pts={[90, 150, 90, 190]} color="soft" />
      </Canvas>
    </Figure>
  );
}
