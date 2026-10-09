/**
 * LifeSavers United - Doctors Network Script
 * File: scripts/doctors-network.js
 * Handles:
 * - Form validation and submission to /doctor-signup
 * - UI feedback (loading, error alerts, success state)
 * - Dynamic specialty dropdown handling
 * - FAQ accordion toggling
 * - Smooth anchor scrolling
 */

document.addEventListener('DOMContentLoaded', () => {
  initFAQAccordion();
  initSpecialtyToggle();
  initFormHandler();
  initSmoothScroll();
  initCurrentYear();
});

/**
 * Normalizes phone number to 10-digit format (India standard)
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length > 10) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length > 10) {
    cleaned = cleaned.slice(-10);
  }
  return cleaned;
}

/**
 * Initialize FAQ Accordion functionality
 */
function initFAQAccordion() {
  const triggers = document.querySelectorAll('.faq-accordion-trigger, .dn-faq-trigger');
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-accordion-item, .dn-faq-item');
      if (!item) return;
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

      // Close all other accordion items for clean UX
      document.querySelectorAll('.faq-accordion-item, .dn-faq-item').forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          const otherTrigger = otherItem.querySelector('.faq-accordion-trigger, .dn-faq-trigger');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });

      if (isExpanded) {
        item.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/**
 * Handles toggling the custom specialty input when "Other" is selected
 */
function initSpecialtyToggle() {
  const specialtySelect = document.getElementById('doctorSpecialty');
  const otherRow = document.getElementById('otherSpecialtyRow');
  const customInput = document.getElementById('customSpecialty');

  if (!specialtySelect || !otherRow) return;

  specialtySelect.addEventListener('change', () => {
    if (specialtySelect.value === 'Other') {
      otherRow.classList.add('active');
      if (customInput) customInput.focus();
    } else {
      otherRow.classList.remove('active');
      if (customInput) customInput.value = '';
    }
  });
}

/**
 * Initialize Smooth Scrolling for anchor buttons
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/**
 * Set current year in footer
 */
function initCurrentYear() {
  const yearEl = document.getElementById('currentYear');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/**
 * Handles Doctor Registration Form Validation and Submission
 */
function initFormHandler() {
  const form = document.getElementById('doctorRegistrationForm');
  const alertBox = document.getElementById('dnFormAlert');
  const successBox = document.getElementById('dnFormSuccessBox');
  const submitBtn = document.getElementById('dnSubmitBtn');
  const btnText = document.getElementById('dnBtnText');
  const btnSpinner = document.getElementById('dnBtnSpinner');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const prefix = document.getElementById('namePrefix')?.value || 'Dr.';
    const rawName = document.getElementById('doctorName')?.value.trim();
    const specialtySelect = document.getElementById('doctorSpecialty')?.value;
    const customSpecialty = document.getElementById('customSpecialty')?.value.trim();
    const hospital = document.getElementById('doctorHospital')?.value.trim();
    const city = document.getElementById('doctorCity')?.value.trim();
    const rawPhone = document.getElementById('doctorPhone')?.value.trim();
    const email = document.getElementById('doctorEmail')?.value.trim();
    const regNumber = document.getElementById('doctorRegNumber')?.value.trim();
    const consentAccuracy = document.getElementById('consentAccuracy')?.checked;
    const joinWhatsApp = document.getElementById('joinWhatsApp')?.checked;

    const specialty = specialtySelect === 'Other' ? customSpecialty : specialtySelect;
    const phone = cleanPhoneNumber(rawPhone);

    // ── Client-side validation ──
    if (!rawName || rawName.length < 2) {
      showAlert('Please enter your full name.');
      document.getElementById('doctorName')?.focus();
      return;
    }

    if (!specialty) {
      showAlert('Please select or specify your medical specialty / field of practice.');
      document.getElementById('doctorSpecialty')?.focus();
      return;
    }

    if (!hospital) {
      showAlert('Please enter your hospital, clinic, or practice name.');
      document.getElementById('doctorHospital')?.focus();
      return;
    }

    if (!city) {
      showAlert('Please enter your city.');
      document.getElementById('doctorCity')?.focus();
      return;
    }

    if (!phone || phone.length < 10) {
      showAlert('Please enter a valid 10-digit mobile / WhatsApp number.');
      document.getElementById('doctorPhone')?.focus();
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Please enter a valid email address, or leave it blank.');
      document.getElementById('doctorEmail')?.focus();
      return;
    }

    if (!consentAccuracy) {
      showAlert('Please confirm the accuracy declaration and consent checkbox to proceed.');
      document.getElementById('consentAccuracy')?.focus();
      return;
    }

    const fullNameWithPrefix = `${prefix} ${rawName}`;

    const payload = {
      fullName: fullNameWithPrefix,
      namePrefix: prefix,
      doctorName: rawName,
      specialty: specialty,
      hospital: hospital,
      city: city,
      phone: phone,
      email: email,
      regNumber: regNumber || '',
      consentAccuracy: true,
      joinWhatsApp: Boolean(joinWhatsApp),
      submittedAt: new Date().toISOString()
    };

    // ── Loading state ──
    setLoading(true);

    try {
      const response = await fetch('/doctor-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && (result.success !== false)) {
        // Success state
        displaySuccessState(fullNameWithPrefix, phone, Boolean(joinWhatsApp), email);
      } else {
        showAlert(result.error || result.message || 'We could not submit your details. Please check your connection and try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Submission error:', err);
      // Fallback: If network is offline or server returned unexpected response, check if mock succeeded
      showAlert('Unable to submit your application. Please check your internet connection or reach out to us at lifesaversunited.india@gmail.com.');
      setLoading(false);
    }
  });

  function showAlert(msg) {
    if (!alertBox) return;
    alertBox.textContent = '⚠️ ' + msg;
    alertBox.classList.add('visible');
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    if (!alertBox) return;
    alertBox.classList.remove('visible');
    alertBox.textContent = '';
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    if (isLoading) {
      if (btnText) btnText.textContent = 'Submitting Details…';
      if (btnSpinner) btnSpinner.classList.remove('dn-hidden');
    } else {
      if (btnText) btnText.textContent = 'Submit Details & Join Network';
      if (btnSpinner) btnSpinner.classList.add('dn-hidden');
    }
  }

  function displaySuccessState(doctorName, phone, optedWhatsApp, email) {
    if (form) form.classList.add('dn-hidden');
    if (alertBox) alertBox.classList.add('dn-hidden');
    if (successBox) {
      const nameEl = document.getElementById('successDoctorName');
      const phoneEl = document.getElementById('successDoctorPhone');
      const whatsappNoteEl = document.getElementById('successWhatsAppNote');
      const emailCardEl = document.getElementById('successEmailCard');
      const emailTextEl = document.getElementById('successDoctorEmail');

      if (nameEl) nameEl.textContent = doctorName;
      if (phoneEl) phoneEl.textContent = `+91 ${phone}`;

      if (email && email.includes('@')) {
        if (emailTextEl) emailTextEl.textContent = email;
        if (emailCardEl) emailCardEl.classList.remove('dn-hidden');
      } else {
        if (emailCardEl) emailCardEl.classList.add('dn-hidden');
      }

      if (whatsappNoteEl) {
        if (optedWhatsApp) {
          whatsappNoteEl.textContent = `You are now connected with our coordination team at +91 ${phone}. You can also reach our 24/7 helpline anytime for critical case collaboration.`;
        } else {
          whatsappNoteEl.textContent = `Your details have been recorded for voluntary medical advisory consultations. Our team will contact you at +91 ${phone} when relevant cases arise.`;
        }
      }

      successBox.classList.add('visible');
      successBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
