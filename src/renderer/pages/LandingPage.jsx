import React, { useState, useEffect, useCallback, useRef } from 'react';
import useStore from '../store/useStore';
import slide1 from '../assets/slide/1.png';
import slide2 from '../assets/slide/2.png';
import slide3 from '../assets/slide/3.png';
import logo from '../assets/logo.png';
import threadMachines from '../assets/facility/sewing-thread-machines.jpg';
import threadCones from '../assets/facility/sewing-thread-cones.jpg';
import elasticMain from '../assets/facility/elastic.jpg';
import elasticDetail from '../assets/facility/elastic-detail.jpg';
import drawstringMain from '../assets/facility/drawstring.jpg';
import drawstringDetail from '../assets/facility/drawstring-detail.jpg';
import narrowTapeMain from '../assets/facility/narrow-tape.jpg';
import narrowTapeDetail from '../assets/facility/narrow-tape-detail.jpg';
import embroideryMain from '../assets/facility/embroidery.jpg';
import embroideryDetail from '../assets/facility/embroidery-detail.jpg';
import laserMain from '../assets/facility/laser-cutter.jpg';
import laserDetail from '../assets/facility/laser-cutter-detail.jpg';
import heatSealMain from '../assets/facility/heat-seal.jpg';
import heatSealDetail from '../assets/facility/heat-seal-detail.jpg';
import thermalMain from '../assets/facility/thermal-printer.jpg';
import thermalDetail from '../assets/facility/thermal-printer-detail.jpg';
import careLabelMain from '../assets/facility/care-label.jpg';
import careLabelDetail from '../assets/facility/care-label-detail.jpg';
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

const capabilities = [
  {
    id: 'sewing-thread',
    name: 'Sewing Thread',
    lead: 'Four YOUNGFU YF-Series winding machines, built by Ningbo Yongfu Textile Machinery Co., Ltd. to international standards.',
    body: 'Multi-spindle operation and stable performance deliver consistent, high-volume winding with uniform tension and excellent thread strength — premium threads with minimal breakage, suitable for garments, textiles and accessories.',
    specs: [
      { value: '4', label: 'YF-Series Machines' },
      { value: '5,094', label: 'Cones per Machine' },
      { value: '350 kg', label: 'Capacity Each' },
      { value: '380V / 50Hz', label: 'Power — 6 A' },
    ],
    images: [
      { src: threadMachines, alt: 'YOUNGFU YF-Series sewing thread winding machines in operation' },
      { src: threadCones, alt: 'Finished sewing thread cones' },
    ],
  },
  {
    id: 'elastic',
    name: 'Elastic',
    lead: 'Four advanced elastic machines in a range of widths and designs, crafted by DAHU DAH HEER Industrial Co. Ltd.',
    body: 'Engineered for superior stretch, lasting durability and a flawless finish, they hold consistent high-quality results across woven and knitted elastics.',
    specs: [
      { value: '4', label: 'Elastic Machines' },
      { value: '380 V', label: 'Operating Power' },
      { value: '150', label: 'Gauge Capacity' },
    ],
    images: [
      { src: elasticMain, alt: 'Elastic knitting machine on the production floor' },
      { src: elasticDetail, alt: 'Woven and knitted elastic tapes' },
    ],
  },
  {
    id: 'drawstring',
    name: 'Drawstring',
    lead: 'Five versatile drawstring machines with various gauge options, plus two multicolour drawcord machines from XUXHOU HENGHUI Braiding Machine Co., Ltd.',
    body: 'Each drawcord machine carries eight heads for intricate designs, and the line as a whole delivers reliable performance and high-quality output.',
    specs: [
      { value: '5', label: 'Drawstring Machines' },
      { value: '2', label: 'Multicolour Drawcord' },
      { value: '8', label: 'Heads per Machine' },
    ],
    images: [
      { src: drawstringMain, alt: 'Braiding machines producing drawstrings' },
      { src: drawstringDetail, alt: 'Finished drawcords in multiple colours' },
    ],
  },
  {
    id: 'narrow-tape',
    name: 'Narrow Tape',
    lead: 'Four narrow tape machines from KYANG THE Industrial Co. Ltd, producing grosgrain, twill, herringbone and fancy tapes.',
    body: 'Alongside them, a Lycra tape machine with continuous dyeing handles elastic and stretchable tapes — precision and durability across diverse tape applications.',
    specs: [
      { value: '4', label: 'Tape Machines' },
      { value: '12 mm', label: 'Max Gauge' },
      { value: '1', label: 'Lycra Tape Line' },
      { value: '10 mm', label: 'Lycra Width' },
    ],
    images: [
      { src: narrowTapeMain, alt: 'Needle loom weaving narrow tape' },
      { src: narrowTapeDetail, alt: 'Grosgrain, twill and herringbone tapes' },
    ],
  },
  {
    id: 'embroidery',
    name: 'Embroidery',
    lead: 'TAJIMA embroidery machines combining accuracy and versatility across both high-volume output and rapid creative experimentation.',
    body: 'One bulk unit with twenty heads covers large-scale production, while a six-head sample unit keeps design development and prototyping quick.',
    specs: [
      { value: '20', label: 'Bulk Unit Heads' },
      { value: '6', label: 'Sample Unit Heads' },
      { value: 'TAJIMA', label: 'Manufacturer' },
    ],
    images: [
      { src: embroideryMain, alt: 'TAJIMA multi-head embroidery machine' },
      { src: embroideryDetail, alt: 'Embroidered brand logo on fabric' },
    ],
  },
  {
    id: 'laser-cutter',
    name: 'Laser Cutter',
    lead: 'The CK-Super 350 — a compact yet powerful unit designed to cut vinyl stickers with ease.',
    body: 'Consistent sticker application makes it ideal for efficient production runs and professional finishing across garment decoration work.',
    specs: [
      { value: '70 mm', label: 'Cutting Capacity' },
      { value: '350 W', label: 'Power Output' },
      { value: 'CK-Super', label: 'Model 350' },
    ],
    images: [
      { src: laserMain, alt: 'CK-Super 350 laser cutting unit' },
      { src: laserDetail, alt: 'Laser-cut vinyl transfer on a garment panel' },
    ],
  },
  {
    id: 'heat-seal',
    name: 'Heat Seal',
    lead: 'Engineered for efficiency, this machine automates the application of heat-sealed stickers.',
    body: 'It delivers uniform results while reducing hands-on labour — a single-unit system built for speed and accuracy in fast-paced production environments.',
    specs: [
      { value: '1', label: 'Single Unit' },
      { value: 'Automated', label: 'Application' },
      { value: 'Uniform', label: 'Seal Quality' },
    ],
    images: [
      { src: heatSealMain, alt: 'Heat seal sticker application press' },
      { src: heatSealDetail, alt: 'Heat-sealed label applied to a garment' },
    ],
  },
  {
    id: 'thermal-printer',
    name: 'Thermal Sticker Printer',
    lead: 'The TSC T8000 thermal sticker printer, designed for high-performance manufacturing environments.',
    body: 'Built with durability and precision in mind, it delivers reliable, high-speed label printing for factories, warehouses and logistics operations that demand consistent output and minimal downtime.',
    specs: [
      { value: 'T8000', label: 'TSC Model' },
      { value: 'High', label: 'Print Speed' },
      { value: 'Industrial', label: 'Duty Class' },
    ],
    images: [
      { src: thermalMain, alt: 'TSC T8000 thermal sticker printer' },
      { src: thermalDetail, alt: 'Printed barcode label sheet' },
    ],
  },
  {
    id: 'care-label',
    name: 'Care Label',
    lead: 'A care label machine that leverages ultrasonic cutting with automatic curing.',
    body: 'The process delivers high-quality labels with minimal material loss, supporting both productivity and sustainability across every order.',
    specs: [
      { value: 'Ultrasonic', label: 'Cutting Method' },
      { value: 'Automatic', label: 'Curing Cycle' },
      { value: 'Minimal', label: 'Material Loss' },
    ],
    images: [
      { src: careLabelMain, alt: 'Ultrasonic care label cutting machine' },
      { src: careLabelDetail, alt: 'Printed garment care labels' },
    ],
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

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  // Reveal-on-scroll: fades content in once, then stops observing
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const targets = root.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('in-view'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { root, rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    targets.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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
      {/* ─── Aurora backdrop (fixed, behind every section) ─── */}
      <div className="aurora-field" aria-hidden="true">
        <div className="aurora-blob aurora-a" />
        <div className="aurora-blob aurora-b" />
        <div className="aurora-blob aurora-c" />
        <div className="aurora-blob aurora-d" />
      </div>
      <div className="aurora-grain" aria-hidden="true" />

      {/* ─── Floating Glass Navigation ─── */}
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

      {/* ─── Hero ─── */}
      <section className="landing-hero" id="hero">
        <div className="hero-slides-container">
          {slides.map((slide, index) => (
            <div key={index} className={`hero-slide ${index === currentSlide ? 'slide-active' : ''}`}>
              <div className="hero-slide-image" style={{ backgroundImage: `url(${slide.image})` }} />
            </div>
          ))}
        </div>

        <div className="hero-overlay" />

        {/* Glass pane */}
        <div className="hero-content">
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

      </section>

      {/* ─── About ─── */}
      <section className="landing-section" id="about">
        <div className="section-container">
          <div className="section-header reveal" data-reveal>
            <span className="section-tag">Who We Are</span>
            <h2 className="section-title">About KA Design Accessories</h2>
            <p className="section-subtitle">
              A leading manufacturer committed to delivering premium quality products
              with innovation, integrity, and excellence at every step.
            </p>
          </div>

          <div className="about-grid">
            <div className="about-card reveal" data-reveal style={{ transitionDelay: '0ms' }}>
              <div className="about-card-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3>Quality First</h3>
              <p>Every product that leaves our facility passes through rigorous quality checks ensuring world-class standards.</p>
            </div>

            <div className="about-card reveal" data-reveal style={{ transitionDelay: '90ms' }}>
              <div className="about-card-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3>Global Reach</h3>
              <p>Our products reach customers across the globe, backed by a robust supply chain and trusted logistics network.</p>
            </div>

            <div className="about-card reveal" data-reveal style={{ transitionDelay: '180ms' }}>
              <div className="about-card-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

      {/* ─── Mission ─── */}
      <section className="landing-section section-dark" id="mission">
        <div className="section-container">
          <div className="mission-layout reveal" data-reveal>
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

      {/* ─── Facility ─── */}
      <section className="landing-section" id="facility">
        <div className="section-container">
          <div className="section-header reveal" data-reveal>
            <span className="section-tag">Our Facility</span>
            <h2 className="section-title">A Tour of Excellence</h2>
            <p className="section-subtitle">
              From our expansive production floors to our dedicated logistics, every corner of our facility
              is designed for maximum efficiency and quality.
            </p>
          </div>

          <div className="facility-gallery">
            {slides.map((slide, index) => (
              <div key={index} className="gallery-item reveal" data-reveal style={{ transitionDelay: `${index * 90}ms` }}>
                <img src={slide.image} alt={slide.title} />
                <div className="gallery-overlay">
                  <h4>{slide.title}</h4>
                  <p>{slide.subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Production capabilities ── */}
          {capabilities.map((cap) => (
            <article key={cap.id} className="capability-panel reveal" data-reveal>
              <div className="capability-media">
                <img src={cap.images[0].src} alt={cap.images[0].alt} className="capability-img capability-img-main" />
                <img src={cap.images[1].src} alt={cap.images[1].alt} className="capability-img capability-img-inset" />
              </div>

              <div className="capability-body">
                <span className="capability-eyebrow">Machinery &amp; Equipment</span>
                <h3 className="capability-title">{cap.name}</h3>
                <p className="capability-lead">{cap.lead}</p>
                <p className="capability-text">{cap.body}</p>

                <dl className="capability-specs">
                  {cap.specs.map((spec) => (
                    <div key={spec.label} className="capability-spec">
                      <dt>{spec.value}</dt>
                      <dd>{spec.label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          ))}

        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="landing-cta">
        <div className="section-container">
          <div className="cta-content reveal" data-reveal>
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
