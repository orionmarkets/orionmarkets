import { Hero } from "../components/landing/Hero";
import { Hunt } from "../components/landing/Hunt";
import { Pillars } from "../components/landing/Pillars";
import { Simulator } from "../components/landing/Simulator";
import { Stack } from "../components/landing/Stack";
import { Closing } from "../components/landing/Closing";

export default function HomePage() {
  return (
    <div className="landing">
      <Hero />
      <Hunt />
      <Pillars />
      <Simulator />
      <Stack />
      <Closing />
    </div>
  );
}
