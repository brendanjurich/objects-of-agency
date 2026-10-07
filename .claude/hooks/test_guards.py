#!/usr/bin/env python3
"""Should-pass / should-block cases for the three guard hooks:
guard_tags.py, clean-svg's guard_public_svg.py, osmo-in's guard_gsap.py.
Each guard runs as Claude Code runs it: JSON on stdin, exit 2 = blocked.
Run by .githooks/pre-commit; run by hand after editing any guard.
"""
import json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SKILLS = os.path.join(HERE, "..", "skills")
TAGS = os.path.join(HERE, "guard_tags.py")
SVG = os.path.join(SKILLS, "clean-svg", "hooks", "guard_public_svg.py")
GSAP = os.path.join(SKILLS, "osmo-in", "hooks", "guard_gsap.py")


def run(script, payload):
    p = subprocess.run([sys.executable, script], input=json.dumps(payload),
                       capture_output=True, text=True)
    return p.returncode


class Tags(unittest.TestCase):
    BLOCK = [
        "git tag -f v1.0.200",
        "git tag --force v1.0.200 abc123",
        "git tag -d v1.0.200",
        "git tag --delete v1.0.200",
        "git -C /some/repo tag -f v1.0.200",
        "git push origin --delete v1.0.200",
        "git push origin -d v1.0.200",
        "git push origin :v1.0.200",
        "git push origin :refs/tags/v1.0.200",
        "git push -f origin --tags",
        "git push --force origin v1.0.200",
        "git push --force-with-lease origin refs/tags/v1.0.200",
        "cd repo && git tag -f v1.0.200",
    ]
    ALLOW = [
        "git tag v1.0.235",
        "git tag -l",
        "git push origin v1.0.235",
        "git push origin --tags",
        "git push -f origin dev",
        'git commit -m "guard blocks git tag -f now"',
        "git log --oneline -5 && echo 'tag -d'",
        "git push origin --delete old-branch",
    ]

    def test_block(self):
        for c in self.BLOCK:
            with self.subTest(c):
                self.assertEqual(run(TAGS, {"tool_input": {"command": c}}), 2)

    def test_allow(self):
        for c in self.ALLOW:
            with self.subTest(c):
                self.assertEqual(run(TAGS, {"tool_input": {"command": c}}), 0)


class PublicSvg(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = os.path.join(self.tmp.name, "01-projects", "objects-of-agency-website")
        os.makedirs(self.repo)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rel):
        return run(SVG, {"tool_name": "Write", "cwd": self.repo,
                         "tool_input": {"file_path": os.path.join(self.repo, rel)}})

    def bash(self, cmd):
        return run(SVG, {"tool_name": "Bash", "cwd": self.repo,
                         "tool_input": {"command": cmd}})

    def test_block(self):
        self.assertEqual(self.write("docs/logo.svg"), 2)
        self.assertEqual(self.write(".claude/skills/clean-svg/out.svg"), 2)
        self.assertEqual(self.bash("python3 clean_svg.py in.svg -o docs/out.svg"), 2)
        self.assertEqual(self.bash("cp ~/Desktop/logo.svg docs/"), 2)
        self.assertEqual(self.bash("mv a.svg b.svg"), 2)

    def test_allow(self):
        self.assertEqual(self.write("src/svg/logo.svg"), 0)
        self.assertEqual(self.write("src/icons/favicon.svg"), 0)
        self.assertEqual(self.write("docs/notes.md"), 0)
        self.assertEqual(self.bash("cp ~/Desktop/logo.svg src/svg/"), 0)
        outside = os.path.join(self.tmp.name, "02-brand", "out.svg")
        self.assertEqual(self.bash(f"python3 clean_svg.py in.svg -o {outside}"), 0)


class Gsap(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = os.path.join(self.tmp.name, "01-projects", "objects-of-agency-website")

    def tearDown(self):
        self.tmp.cleanup()

    def check(self, rel, text):
        path = os.path.join(self.repo, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return run(GSAP, {"tool_input": {"file_path": path}})

    def test_block(self):
        self.assertEqual(self.check("src/js/a.js", "gsap.defaults({ ease: 'none' });\n"), 2)
        self.assertEqual(self.check("src/js/b.js", "CustomEase.registerEase('x', y);\n"), 2)
        self.assertEqual(self.check("src/js/c.js",
                                    "s.src='https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js';\n"), 2)
        self.assertEqual(self.check("src/css/d.css",
                                    "@import url(https://unpkg.com/gsap/x.css);\n"), 2)

    def test_allow(self):
        banner = "/* Differences from stock:\n   • removed gsap.defaults({ease})\n   • removed CDN gsap.min.js */\n"
        self.assertEqual(self.check("src/js/e.js", banner + "gsap.to(el, { x: 10 });\n"), 0)
        self.assertEqual(self.check("src/js/f.js", "// was: gsap.defaults({})\ngsap.to(el, {});\n"), 0)
        self.assertEqual(self.check("docs/g.js", "gsap.defaults({});\n"), 0)


if __name__ == "__main__":
    unittest.main(verbosity=1)
