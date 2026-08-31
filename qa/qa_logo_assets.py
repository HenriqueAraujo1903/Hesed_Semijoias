#!/usr/bin/env python3
"""
QA técnico dos assets de logo (perfil QA sênior).
Valida resolução, transparência real, integridade da arte e — crítico — que a
versão dark não tem highlights branco-puro estourados que criam "riscos" sobre
fundo escuro. Usa ImageMagick (magick) via subprocess.
"""
import subprocess
import sys
import os

PUB = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")
PASS = 0
FAIL = 0
FAILURES = []


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \u2713 {name}" + (f" ({detail})" if detail else ""))
    else:
        FAIL += 1
        FAILURES.append(name)
        print(f"  \u2717 FAIL: {name}" + (f" ({detail})" if detail else ""))


def magick(path, fmt):
    r = subprocess.run(["magick", os.path.join(PUB, path), "-format", fmt, "info:"],
                       capture_output=True, text=True)
    return r.stdout.strip()


def magick_pipe(args):
    r = subprocess.run(["magick"] + args, capture_output=True, text=True)
    return r.stdout.strip()


def dims(path):
    return int(magick(path, "%w")), int(magick(path, "%h"))


def alpha_at(path, x, y):
    return float(magick(path, f"%[fx:p{{{x},{y}}}.a]"))


def opaque_fraction(path):
    """Fração média do canal alpha (proporção de área opaca)."""
    return float(magick(path, "%[fx:mean]").split()[0]) if False else float(
        subprocess.run(["magick", os.path.join(PUB, path), "-channel", "A", "-separate",
                        "-format", "%[fx:mean]", "info:"], capture_output=True, text=True).stdout.strip())


def bright_opaque_fraction(path, lum_threshold=0.92):
    """
    Fração de pixels que são, ao mesmo tempo, muito claros (luminância > threshold)
    E opacos (alpha alto). Esses são os 'highlights estourados' que incomodam no
    fundo escuro. Calculado compondo a arte sobre PRETO e medindo quão claro o
    resultado fica: só pixel claro+opaco continua claro sobre preto.
    """
    src = os.path.join(PUB, path)
    # compõe sobre preto e conta fração de pixels com luminância > threshold
    r = subprocess.run(
        ["magick", src, "-background", "black", "-flatten", "-colorspace", "Gray",
         "-fuzz", "0", "-fill", "white", f"-threshold", f"{int(lum_threshold*100)}%",
         "-format", "%[fx:mean]", "info:"],
        capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return -1.0


print("===== QA TÉCNICO DOS ASSETS DE LOGO =====\n")

for f in ("logo.png", "logo-dark.png"):
    exists = os.path.exists(os.path.join(PUB, f))
    check(f"{f} existe", exists)

print("\n-- logo.png (fundo claro) --")
w, h = dims("logo.png")
check("logo.png resolução >= 600px de altura (nitidez retina)", h >= 600, f"{w}x{h}")
check("logo.png canto TL transparente", alpha_at("logo.png", 1, 1) == 0)
check("logo.png canto BR transparente", alpha_at("logo.png", w - 2, h - 2) == 0)
op_light = opaque_fraction("logo.png")
check("logo.png área opaca coerente (8%-60%)", 0.08 <= op_light <= 0.60, f"{op_light:.3f}")

print("\n-- logo-dark.png (fundo escuro, tratada) --")
wd, hd = dims("logo-dark.png")
check("logo-dark.png resolução >= 600px de altura", hd >= 600, f"{wd}x{hd}")
check("logo-dark.png canto TL transparente", alpha_at("logo-dark.png", 1, 1) == 0)
check("logo-dark.png canto BR transparente", alpha_at("logo-dark.png", wd - 2, hd - 2) == 0)
op_dark = opaque_fraction("logo-dark.png")
check("logo-dark.png área opaca coerente (8%-60%)", 0.08 <= op_dark <= 0.60, f"{op_dark:.3f}")

print("\n-- highlights estourados (crítico p/ fundo escuro) --")
bright_light = bright_opaque_fraction("logo.png")
bright_dark = bright_opaque_fraction("logo-dark.png")
print(f"  fração clara+opaca — clara: {bright_light:.5f} | dark: {bright_dark:.5f}")
# A dark deve ter MENOS highlights estourados que a clara (foi tratada) e ~zero absoluto
check("logo-dark.png tem menos highlights estourados que a clara", bright_dark <= bright_light,
      f"dark={bright_dark:.5f} <= clara={bright_light:.5f}")
check("logo-dark.png highlights estourados quase nulos (< 0.5%)", bright_dark < 0.005,
      f"{bright_dark:.5f}")

print("\n-- consistência entre as duas versões --")
check("mesma resolução nas duas versões", (w, h) == (wd, hd), f"{w}x{h} vs {wd}x{hd}")
# área opaca deve ser praticamente igual (mesma arte, só tratamento de cor)
check("área da arte consistente entre versões (diff < 3%)", abs(op_light - op_dark) < 0.03,
      f"clara={op_light:.3f} dark={op_dark:.3f}")

print("\n" + "=" * 55)
print(f"TOTAL: {PASS+FAIL} | PASS: {PASS} | FAIL: {FAIL}")
print("=" * 55)
if FAILURES:
    for name in FAILURES:
        print(f"  - {name}")
sys.exit(0 if FAIL == 0 else 1)
