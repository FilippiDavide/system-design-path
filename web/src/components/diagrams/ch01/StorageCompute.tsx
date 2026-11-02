import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Group, Label, NEON } from "../primitives";

/**
 * Traditional node vs cloud-native disaggregation. The local disk
 * becomes a cache, durable bytes move to services across the network.
 */
export function StorageCompute() {
  return (
    <Figure
      label="FIG 05"
      title="separation of storage and compute"
      caption="Left: compute and durable storage on the same box. Right: the VM's disk is an ephemeral cache; durable data lives in object storage (big chunks) and a small-value service. Native systems avoid the virtual disk, where every I/O is a network round trip."
    >
      <Canvas w={780} h={320}>
        <Group x={20} y={40} w={220} h={250} label="traditional" />
        <Box x={60} y={70} w={140} h={60} title="CPU + RAM" />
        <Arrow pts={[130, 130, 130, 180]} noHead width={2} />
        <Cylinder x={60} y={180} w={140} h={80} title="Local disk" sub={"RAID · durable"} accent={NEON.green} />

        <Group x={290} y={40} w={470} h={250} label="cloud native · disaggregated" />
        <Box x={320} y={70} w={160} h={70} title="VM · compute" sub={"local disk =\nephemeral cache"} accent={NEON.blue} />

        <Arrow pts={[480, 90, 560, 90]} color="orange" dashed label="avoided" />
        <Cylinder x={560} y={60} w={170} h={60} title="Virtual disk" sub="EBS · every I/O over network" accent={NEON.orange} />

        <Arrow pts={[480, 110, 520, 110, 520, 185, 560, 185]} />
        <Cylinder x={560} y={150} w={170} h={64} title="Object storage" sub="S3 · large files" accent={NEON.green} />

        <Arrow pts={[480, 125, 510, 125, 510, 255, 560, 255]} />
        <Cylinder x={560} y={226} w={170} h={54} title="Small-value service" sub="separate, fast" accent={NEON.green} />

        <Label x={400} y={200} lines={"analysis = move bytes\nover the network"} size={10} mono color="var(--ink-2)" />
        <Label x={400} y={262} lines={"instance dies or resizes:\nlocal disk is gone"} size={10} mono color="var(--neon-5)" />
      </Canvas>
    </Figure>
  );
}
