import React from 'react'
import { Button } from "@/components/ui/button"
import Header from '@/components/custom/header'
import Hero from '@/components/custom/hero'
import Features from '@/components/custom/features'
import AboutContact from '@/components/custom/aboutAndContact'
import Footer from '@/components/custom/footer'

const page = () => {
  return (
    <div>
      <Header />
      <Hero />
      <Features />
      <AboutContact />
      <Footer />
    </div>
  )
}

export default page