PY=python
PIP=pip
VENV=.venv

.PHONY: venv install run api cli test docker-build docker-run

venv:
	$(PY) -m venv $(VENV)
	. $(VENV)/bin/activate; $(PIP) install -r requirements.txt

install:
	. $(VENV)/bin/activate; $(PIP) install -r requirements.txt

run:
	. $(VENV)/bin/activate; $(PY) -m signal_to_lead.service --host 0.0.0.0 --port 8000

cli:
	. $(VENV)/bin/activate; $(PY) -m signal_to_lead.cli score-route --config configs/default.yaml --in data/sample_leads.jsonl --out /tmp/out.jsonl

docker-build:
	docker build -t signal-to-lead:latest .

docker-run:
	docker run --rm -p 8000:8000 signal-to-lead:latest

test:
	@echo "(tests pending)"
