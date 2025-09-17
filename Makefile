PY=python
PIP=pip
VENV=.venv

.PHONY: venv install run api cli test docker-build docker-run setup

venv:
	$(PY) -m venv $(VENV)
	. $(VENV)/bin/activate; $(PIP) install -r requirements.txt

install:
	. $(VENV)/bin/activate; $(PIP) install -r requirements.txt

setup: venv install

run:
	. $(VENV)/bin/activate; $(PY) scripts/cli.py "operations manager" --location "US" --out /tmp/leads.csv

docker-build:
	docker build -t signal-to-lead:latest .

docker-run:
	docker run --rm -p 8000:8000 signal-to-lead:latest

test:
	. $(VENV)/bin/activate; pytest -q
