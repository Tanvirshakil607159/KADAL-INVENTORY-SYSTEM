import React, { useState, useEffect, useCallback, useRef } from 'react';
import useStore from '../store/useStore';
import slide1 from '../assets/slide/1.png';
import slide2 from '../assets/slide/2.png';
import slide3 from '../assets/slide/3.png';
import logo from '../assets/logo.png';
import './LandingPage.css';

const slides = [
  {
    image: slide1,
    title: 'Our State-of-the-Art Facility',
    subtitle: 'Built with precision and care to deliver excellence',
    description: 'Our modern factory complex stands as a testament to our commitment to quality manufacturing and sustainable business practices.',
  },
  {
    image: slide2,
    title: 'World-Class Production Floor',
    subtitle: 'Where innovation meets craftsmanship',
    description: 'Equipped with cutting-edge machinery and technology, our production floor operates at the highest standards of efficiency and quality.',
  },
  {
    image: slide3,
    title: 'Seamless Supply Chain',
    subtitle: 'Reliable delivery, every single time',
    description: 'From production to delivery, we ensure every step of our supply chain maintains the quality and reliability our partners trust.',
  },
];

export default function LandingPage({ onEnterApp }) {
  const { isLoggedIn, user } = useStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef(null);

  const goToSlide = useCallback((index) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), 1200);
  }, [isTransitioning]);

  const nextSlide = useCallback(() => {
    goToSlide((currentSlide + 1) % slides.length);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide((currentSlide - 1 + slides.length) % slides.length);
  }, [currentSlide, goToSlide]);

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  // Scroll listener for navbar effect
  const handleScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    setScrolled(top > 40);
  };

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="landing-page" ref={containerRef} onScroll={handleScroll}>
      {/* ─── Fixed Navigation Bar ─── */}
      <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''}`}>
        <div className="nav-inner">
          <div className="nav-brand" onClick={() => scrollToSection('hero')} style={{ cursor: 'pointer' }}>
            <img src={logo} alt="KADAL" className="nav-logo" />
            <div className="nav-brand-text">
              <span className="nav-brand-name">KADAL</span>
              <span className="nav-brand-sub">KA Design Accessories LTD</span>
            </div>
          </div>
          <div className="nav-links">
            <button type="button" onClick={() => scrollToSection('about')} className="nav-link-btn">About</button>
            <button type="button" onClick={() => scrollToSection('mission')} className="nav-link-btn">Mission</button>
            <button type="button" onClick={() => scrollToSection('facility')} className="nav-link-btn">Facility</button>
            <button className={`nav-cta ${isLoggedIn ? 'nav-cta-active' : ''}`} onClick={onEnterApp}>
              <span>{isLoggedIn ? (user?.fullName ? `Dashboard (${user.fullName.split(' ')[0]})` : 'Back to Dashboard') : 'Open App'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero Slideshow Section ─── */}
      <section className="landing-hero" id="hero">
        {/* Slide Images */}
        <div className="hero-slides-container">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`hero-slide ${index === currentSlide ? 'slide-active' : ''}`}
            >
              <div
                className="hero-slide-image"
                style={{ backgroundImage: `url(${slide.image})` }}
              />
            </div>
          ))}
        </div>

        {/* Dark overlay gradient */}
        <div className="hero-overlay" />

        {/* Floating particles */}
        <div className="hero-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              '--x': `${Math.random() * 100}%`,
              '--y': `${Math.random() * 100}%`,
              '--delay': `${Math.random() * 8}s`,
              '--duration': `${6 + Math.random() * 10}s`,
              '--size': `${2 + Math.random() * 4}px`,
            }} />
          ))}
        </div>

        {/* Hero Content */}
        <div className="hero-content">
          <div className="hero-badge">
            <div className="badge-dot" />
            <span>{isLoggedIn ? `Active Session: ${user?.fullName || 'User'} (${user?.roleName || 'Member'})` : 'Established Excellence'}</span>
          </div>

          <h1 className="hero-title" key={`title-${currentSlide}`}>
            {slides[currentSlide].title.split(' ').map((word, i) => (
              <span key={i} className="word-animate" style={{ '--word-delay': `${i * 0.08}s` }}>
                {word}{' '}
              </span>
            ))}
          </h1>

          <p className="hero-subtitle" key={`sub-${currentSlide}`}>
            {slides[currentSlide].subtitle}
          </p>

          <p className="hero-description" key={`desc-${currentSlide}`}>
            {slides[currentSlide].description}
          </p>

          <div className="hero-actions">
            <button className="hero-btn-primary" onClick={onEnterApp}>
              <span>{isLoggedIn ? 'Continue to Dashboard' : 'Access Inventory System'}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <button type="button" onClick={() => scrollToSection('about')} className="hero-btn-secondary">
              <span>Learn More</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Slide Controls */}
        <div className="hero-controls">
          <button className="slide-arrow slide-arrow-prev" onClick={prevSlide} aria-label="Previous slide">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="slide-indicators">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`slide-indicator ${index === currentSlide ? 'indicator-active' : ''}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              >
                <div className="indicator-fill" />
              </button>
            ))}
          </div>

          <button className="slide-arrow slide-arrow-next" onClick={nextSlide} aria-label="Next slide">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Slide counter */}
        <div className="hero-slide-counter">
          <span className="counter-current">{String(currentSlide + 1).padStart(2, '0')}</span>
          <span className="counter-separator">/</span>
          <span className="counter-total">{String(slides.length).padStart(2, '0')}</span>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator" onClick={() => scrollToSection('about')} style={{ cursor: 'pointer' }}>
          <div className="scroll-mouse">
            <div className="scroll-wheel" />
          </div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* ─── About Section ─── */}
      <section className="landing-section" id="about">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Who We Are</span>
            <h2 className="section-title">About KA Design Accessories</h2>
            <p className="section-subtitle">
              A leading manufacturer committed to delivering premium quality products
              with innovation, integrity, and excellence at every step.
            </p>
          </div>

          <div className="about-grid">
            <div className="about-card">
              <div className="about-card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3>Quality First</h3>
              <p>Every product that leaves our facility passes through rigorous quality checks ensuring world-class standards.</p>
            </div>

            <div className="about-card">
              <div className="about-card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3>Global Reach</h3>
              <p>Our products reach customers across the globe, backed by a robust supply chain and trusted logistics network.</p>
            </div>

            <div className="about-card">
              <div className="about-card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3>Our People</h3>
              <p>Our skilled workforce is the backbone of our operations, trained and empowered to deliver their very best every day.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Mission Section ─── */}
      <section className="landing-section section-dark" id="mission">
        <div className="section-container">
          <div className="mission-layout">
            <div className="mission-text">
              <span className="section-tag tag-light">Our Mission</span>
              <h2 className="section-title title-light">Empowering Growth Through Innovation</h2>
              <p className="mission-description">
                At KA Design Accessories LTD, our mission is to be the benchmark of quality in the accessories
                manufacturing industry. We believe in sustainable practices, empowering our workforce,
                and continuously pushing the boundaries of what's possible.
              </p>
              <div className="mission-stats">
                <div className="stat-item">
                  <span className="stat-number">500+</span>
                  <span className="stat-label">Team Members</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">50K+</span>
                  <span className="stat-label">Products Made</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">99%</span>
                  <span className="stat-label">Quality Rating</span>
                </div>
              </div>
            </div>
            <div className="mission-visual">
              <div className="mission-image-stack">
                <img src={slide1} alt="KA Design Facility" className="mission-img mission-img-1" />
                <img src={slide2} alt="Production Floor" className="mission-img mission-img-2" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Facility Showcase Section ─── */}
      <section className="landing-section" id="facility">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Our Facility</span>
            <h2 className="section-title">A Tour of Excellence</h2>
            <p className="section-subtitle">
              From our expansive production floors to our dedicated logistics, every corner of our facility
              is designed for maximum efficiency and quality.
            </p>
          </div>

          <div className="facility-gallery">
            {slides.map((slide, index) => (
              <div key={index} className="gallery-item">
                <img src={slide.image} alt={slide.title} />
                <div className="gallery-overlay">
                  <h4>{slide.title}</h4>
                  <p>{slide.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="landing-cta">
        <div className="cta-bg-pattern" />
        <div className="section-container">
          <div className="cta-content">
            <h2>Ready to Get Started?</h2>
            <p>Access the KADAL Inventory Management System to streamline your operations.</p>
            <button className="cta-button" onClick={onEnterApp}>
              <span>{isLoggedIn ? 'Return to Dashboard' : 'Launch Inventory App'}</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="section-container">
          <div className="footer-inner">
            <div className="footer-brand">
              <img src={logo} alt="KADAL" className="footer-logo" />
              <span>KA Design Accessories LTD</span>
            </div>
            <p className="footer-copy">© {new Date().getFullYear()} KA Design Accessories LTD. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
