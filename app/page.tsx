import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Shield, Globe, BarChart3 } from "lucide-react"; // Changed ChartBar to BarChart3

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">InvestTracker</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/about" className="text-gray-600 hover:text-gray-900">
              About
            </Link>
            <Link href="/features" className="text-gray-600 hover:text-gray-900">
              Features
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Smart Investment Tracking
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Make data-driven investment decisions with real-time analysis, 
          AI-powered insights, and comprehensive portfolio management.
        </p>
        <Link href="/register">
          <Button size="lg" className="text-lg px-8 py-6">
            Start Free Trial
          </Button>
        </Link>
        <p className="text-sm text-gray-500 mt-4">
          No credit card required • Free forever for basic use
        </p>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything you need to manage your investments
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <BarChart3 className="h-12 w-12 text-blue-600 mb-4" /> {/* Changed from ChartBar */}
              <h3 className="font-semibold text-lg mb-2">Real-time Tracking</h3>
              <p className="text-gray-600">
                Monitor your portfolio with live market data and instant updates.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <TrendingUp className="h-12 w-12 text-green-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">AI-Powered Analysis</h3>
              <p className="text-gray-600">
                Get intelligent insights with our advanced scoring algorithms.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <Globe className="h-12 w-12 text-purple-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Multi-Market Support</h3>
              <p className="text-gray-600">
                Track stocks and ETFs from US and European markets.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <Shield className="h-12 w-12 text-orange-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Bank-Level Security</h3>
              <p className="text-gray-600">
                Your data is encrypted and protected with enterprise security.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to take control of your investments?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of investors making smarter decisions.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <TrendingUp className="h-6 w-6 text-blue-600" />
              <span className="font-semibold">InvestTracker</span>
            </div>
            <p className="text-sm text-gray-600">
              © 2024 InvestTracker. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}