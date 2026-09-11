"""Compile both Harvard-style LaTeX CVs into the existing public PDF paths.

Usage: python scripts/build-cv.py [--engine /path/to/tectonic-or-pdflatex]
Requires Python 3.9+ and Tectonic or pdfLaTeX. No Python packages required.
Sources can also be compiled individually using Overleaf or a local TeX setup.
"""
import argparse
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    'cv-en.tex': 'CV_Davide_Di_Matteo.pdf',
    'cv.tex': 'CV_Davide_Di_Matteo_IT.pdf',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engine', help='Path to tectonic or pdflatex executable')
    args = parser.parse_args()
    engine = args.engine or shutil.which('tectonic') or shutil.which('pdflatex')
    if not engine:
        parser.error('Install Tectonic or pdfLaTeX, or pass --engine /path/to/executable.')
    is_tectonic = Path(engine).stem.lower() == 'tectonic'
    if not is_tectonic and Path(engine).stem.lower() != 'pdflatex':
        parser.error('Supported engines: tectonic and pdflatex.')
    engine = str(Path(shutil.which(engine) or engine).resolve())
    with tempfile.TemporaryDirectory(prefix='ddm-cv-') as temp:
        staged = []
        for source, output in SOURCES.items():
            source_path = ROOT / source
            if is_tectonic:
                command = [engine, '--keep-logs', '--outdir', temp, str(source_path)]
                subprocess.run(command, cwd=ROOT, check=True)
            else:
                command = [engine, '-no-shell-escape', '-interaction=nonstopmode',
                           '-halt-on-error', f'-output-directory={temp}', str(source_path)]
                for _ in range(2):
                    subprocess.run(command, cwd=ROOT, check=True)
            log = (Path(temp) / (source_path.stem + '.log')).read_text(encoding='utf-8', errors='replace')
            if re.search(r'Overfull \\[hv]box|Missing character:|LaTeX Font Warning:', log):
                raise RuntimeError(f'{source}: fix overflow, missing glyphs or font substitutions before publishing.')
            if not re.search(r'\(1 page[,)]', log):
                raise RuntimeError(f'{source}: expected one page; review the layout before publishing.')
            pdf = Path(temp) / (source_path.stem + '.pdf')
            if not pdf.read_bytes().startswith(b'%PDF-'):
                raise RuntimeError(f'{source}: compiler did not produce a PDF.')
            staged.append((pdf, ROOT / output))
        # Update public downloads only after both sources compile successfully.
        for source, output in staged:
            shutil.copyfile(source, output)
            print(f'Built {output.name}')


if __name__ == '__main__':
    main()
