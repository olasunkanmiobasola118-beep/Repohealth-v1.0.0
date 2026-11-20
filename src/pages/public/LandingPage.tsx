import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Navbar } from '../../components/landing/Navbar';
import { HeroSection } from '../../components/landing/HeroSection';
import { CapabilityStrip } from '../../components/landing/CapabilityStrip';
import { ProblemSection } from '../../components/landing/ProblemSection';
import { WorkflowSection } from '../../components/landing/WorkflowSection';
import { AIDoctorShowcase } from '../../components/landing/AIDoctorShowcase';
import { CodeFixShowcase } from '../../components/landing/CodeFixShowcase';
import { AnalysisSection } from '../../components/landing/AnalysisSection';
import { ModelSelectionShowcase } from '../../components/landing/ModelSelectionShowcase';
import { HealthInsightsSection } from '../../components/landing/HealthInsightsSection';
import { SecuritySection } from '../../components/landing/SecuritySection';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { Footer } from '../../components/landing/Footer';

gsap.registerPlugin(ScrollTrigger);

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.from('.hero-animate', {
        y: 12,
        opacity: 0,
        duration: 0.48,
        stagger: 0.06,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
      });

      gsap.from('.hero-preview-animate', {
        y: 16,
        opacity: 0,
        duration: 0.55,
        delay: 0.14,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
      });

      gsap.utils.toArray<HTMLElement>('.reveal-block').forEach((el) => {
        gsap.from(el, {
          y: 14,
          opacity: 0,
          duration: 0.45,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            once: true,
          },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div id="top" ref={rootRef} className="landing-light min-h-screen flex flex-col bg-white text-[#17171C] overflow-x-clip">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <CapabilityStrip />
        <ProblemSection />
        <WorkflowSection />
        <AIDoctorShowcase />
        <CodeFixShowcase />
        <AnalysisSection />
        <ModelSelectionShowcase />
        <HealthInsightsSection />
        <SecuritySection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
