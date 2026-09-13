"""Shared pytest fixtures for the backend test suite."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.ooxml.package import DocxPackage
from backend.app.ooxml.resolver import resolve_document

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


@pytest.fixture(scope="session")
def reference_paras():
    pkg = DocxPackage.open(os.path.join(FIXTURES_DIR, "climate_reference.docx"))
    return resolve_document(pkg)


@pytest.fixture(scope="session")
def original_paras():
    pkg = DocxPackage.open(os.path.join(FIXTURES_DIR, "climate_original.docx"))
    return resolve_document(pkg)


from backend.app.classify.fallback import classify
from backend.app.ooxml.inventory import digest


@pytest.fixture(scope="session")
def reference_digests(reference_paras):
    from backend.app.classify.fallback import classify
    from backend.app.ooxml.inventory import digest
    hints = classify(reference_paras)
    return digest(reference_paras, hints)


@pytest.fixture(scope="session")
def original_digests(original_paras):
    from backend.app.classify.fallback import classify
    from backend.app.ooxml.inventory import digest
    hints = classify(original_paras)
    return digest(original_paras, hints)


@pytest.fixture(scope="session")
def reference_roles(reference_paras):
    from backend.app.classify.fallback import classify
    return classify(reference_paras)


@pytest.fixture(scope="session")
def original_roles(original_paras):
    from backend.app.classify.fallback import classify
    return classify(original_paras)
