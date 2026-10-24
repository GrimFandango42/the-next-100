"""Exercise the actual deployment script with a failing build and fake Git/npm."""
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy/update.sh'
class DeployRetry(unittest.TestCase):
    def test_failed_build_retries_and_success_skips(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            repo = root / 'repo'; repo.mkdir()
            site = root / 'site'; site.mkdir()
            (site / 'index.html').write_text('old site')
            (site / 'deployed-commit.txt').write_text('oldcommit\n')
            bins = root / 'bin'; bins.mkdir()
            (bins / 'git').write_text('#!/bin/bash\nif [[ "$1" == rev-parse ]]; then echo newcommit; fi\n')
            (bins / 'npm').write_text('''#!/bin/bash
if [[ "$1" == run ]]; then
  echo build >> "$REPO/attempts"
  [[ -f "$REPO/fail" ]] && exit 1
  mkdir -p dist
  echo 'new site' > dist/index.html
fi
''')
            for p in bins.iterdir(): p.chmod(0o755)
            env = {**os.environ,'REPO':str(repo),'SITE':str(site),'LOG':str(root/'log'),'PATH':str(bins)+':'+os.environ['PATH']}
            run = lambda: subprocess.run(['bash',str(SCRIPT)],env=env,capture_output=True)
            (repo/'fail').touch()
            self.assertNotEqual(run().returncode,0)
            self.assertEqual((site/'index.html').read_text(),'old site')
            self.assertEqual((site/'deployed-commit.txt').read_text().strip(),'oldcommit')
            (repo/'fail').unlink()
            self.assertEqual(run().returncode,0)
            self.assertEqual((site/'deployed-commit.txt').read_text().strip(),'newcommit')
            self.assertEqual((root/'site.old/index.html').read_text(),'old site')
            self.assertEqual(run().returncode,0)
            self.assertEqual(len((repo/'attempts').read_text().splitlines()),2)

if __name__ == '__main__': unittest.main()
