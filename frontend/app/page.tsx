import React from "react";
import { Button } from "@/components/ui/button";
import Header from "@/components/custom/header";
import Hero from "@/components/custom/hero";
import Features from "@/components/custom/features";
import Pricing from "@/components/custom/pricing";
import HowItWorks from "@/components/custom/howItWorks";
import AboutContact from "@/components/custom/aboutAndContact";
import Footer from "@/components/custom/footer";
import Testimonials from "@/components/custom/testimonials";

const page = () => {
  return (
    <div>
      <Header />
      <Hero />
      <Testimonials />
      <Features />
      <HowItWorks />
      <Pricing />
      <AboutContact />
      <Footer />
    </div>
  );
};

export default page;
