"use client";
import Image from "next/image";
import { ArrowIcon } from "@/components/arrow-icon";
import { useState } from "react";
const links = [{ label: "Collection", href: "#collection" }, { label: "The ride", href: "#ride" }, { label: "Showroom", href: "#showroom" }];
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="header-shell"><a className="header-logo" href="#top" aria-label="KUEST home"><Image src="/brand/logo/logo-kuest-negro.png" alt="KUEST Electric Bikes" width={178} height={59} priority /></a><nav className="desktop-nav" aria-label="Primary navigation">{links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}</nav><a className="header-cta" href="#showroom">Visit KUEST <ArrowIcon /></a><button className="menu-button" type="button" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((value) => !value)}><span>{open ? "Close" : "Menu"}</span><i aria-hidden="true">{open ? "×" : "☰"}</i></button></div>{open && <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation">{links.map((link) => <a href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowIcon /></a>)}<a href="#showroom" onClick={() => setOpen(false)}>Visit showroom<ArrowIcon /></a></nav>}</header>;
}
