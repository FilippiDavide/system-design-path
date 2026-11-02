import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, NEON } from "../primitives";

/**
 * Who touches the data: the operational side on the left, the
 * analytical side on the right, and the engineers who bridge them.
 */
export function WhoUsesData() {
  return (
    <Figure
      label="FIG 01"
      title="who uses the data"
      caption="Operational systems serve the product; analytical systems get a read-only copy. Data engineers own the bridge, analytics engineers model what lands on the right."
    >
      <Canvas w={780} h={330}>
        {/* Row 1: the main flow */}
        <Box x={20} y={120} w={110} h={56} title="External users" />
        <Arrow pts={[130, 148, 170, 148]} />
        <Box x={170} y={110} w={150} h={76} title="Backend engineers" sub={"services that\nread and write"} />
        <Arrow pts={[320, 148, 360, 148]} />
        <Cylinder x={360} y={104} w={120} h={88} title="Operational" sub="systems" accent={NEON.blue} />
        <Arrow pts={[480, 148, 540, 148]} dashed label="read-only copy" />
        <Cylinder x={540} y={104} w={120} h={88} title="Analytical" sub="systems" accent={NEON.magenta} />

        {/* Consumers of the analytical side */}
        <Arrow pts={[660, 130, 690, 130, 690, 60, 700, 60]} />
        <Box x={700} y={34} w={70} h={52} title="Analysts" sub="BI" titleSize={12} />
        <Arrow pts={[660, 166, 690, 166, 690, 236, 700, 236]} />
        <Box x={700} y={210} w={70} h={52} title="Scientists" sub="ML" titleSize={12} />

        {/* Engineers underneath */}
        <Box x={360} y={262} w={130} h={50} title="Data engineers" sub="integrate both" titleSize={12} dashed />
        <Arrow pts={[400, 262, 400, 196]} dashed color="soft" />
        <Arrow pts={[460, 262, 460, 240, 600, 240, 600, 196]} dashed color="soft" />
        <Box x={530} y={262} w={150} h={50} title="Analytics engineers" sub="model and transform" titleSize={12} dashed />
        <Arrow pts={[640, 262, 640, 196]} dashed color="soft" />

        <Label x={420} y={40} lines="OPERATIONAL" size={10} color={NEON.blue} mono upper />
        <Label x={600} y={40} lines="ANALYTICAL" size={10} color={NEON.magenta} mono upper />
        <line x1={510} y1={20} x2={510} y2={310} stroke="var(--line-soft)" strokeDasharray="3 4" />
      </Canvas>
    </Figure>
  );
}
