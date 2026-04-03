"use strict";
class Calculator {
    constructor() {
        this.currentValue = "0";
        this.previousValue = "";
        this.operator = null;
        this.shouldResetDisplay = false;
        this.display = document.getElementById("display");
        this.render();
        this.attachListeners();
    }
    get value() { return this.currentValue; }
    render() {
        this.display.value = this.currentValue;
    }
    appendDigit(digit) {
        if (this.shouldResetDisplay) {
            this.currentValue = digit;
            this.shouldResetDisplay = false;
        }
        else {
            this.currentValue =
                this.currentValue === "0" ? digit : this.currentValue + digit;
        }
        this.render();
    }
    appendDot() {
        if (this.shouldResetDisplay) {
            this.currentValue = "0.";
            this.shouldResetDisplay = false;
        }
        else if (!this.currentValue.includes(".")) {
            this.currentValue += ".";
        }
        this.render();
    }
    setOperator(op) {
        if (this.operator && !this.shouldResetDisplay) {
            this.calculate();
        }
        this.previousValue = this.currentValue;
        this.operator = op;
        this.shouldResetDisplay = true;
    }
    calculate() {
        if (!this.operator || !this.previousValue)
            return;
        const a = parseFloat(this.previousValue);
        const b = parseFloat(this.currentValue);
        let result;
        switch (this.operator) {
            case "+":
                result = a + b;
                break;
            case "-":
                result = a - b;
                break;
            case "*":
                result = a * b;
                break;
            case "/":
                result = b === 0 ? NaN : a / b;
                break;
            case "^":
                result = Math.pow(a, b);
                break;
        }
        this.currentValue = isNaN(result) ? "Error" : String(parseFloat(result.toFixed(10)));
        this.operator = null;
        this.previousValue = "";
        this.shouldResetDisplay = true;
        this.render();
    }
    clear() {
        this.currentValue = "0";
        this.previousValue = "";
        this.operator = null;
        this.shouldResetDisplay = false;
        this.render();
    }
    toggleSign() {
        if (this.currentValue !== "0") {
            this.currentValue = this.currentValue.startsWith("-")
                ? this.currentValue.slice(1)
                : "-" + this.currentValue;
            this.render();
        }
    }
    percent() {
        this.currentValue = String(parseFloat(this.currentValue) / 100);
        this.render();
    }
    backspace() {
        if (this.currentValue.length > 1) {
            this.currentValue = this.currentValue.slice(0, -1);
        }
        else {
            this.currentValue = "0";
        }
        this.render();
    }
    attachListeners() {
        document.querySelectorAll("[data-action]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const action = btn.dataset.action;
                const value = btn.dataset.value;
                switch (action) {
                    case "digit":
                        this.appendDigit(value);
                        break;
                    case "dot":
                        this.appendDot();
                        break;
                    case "operator":
                        this.setOperator(value);
                        break;
                    case "equals":
                        this.calculate();
                        break;
                    case "clear":
                        this.clear();
                        break;
                    case "sign":
                        this.toggleSign();
                        break;
                    case "percent":
                        this.percent();
                        break;
                    case "backspace":
                        this.backspace();
                        break;
                }
            });
        });
        document.addEventListener("keydown", (e) => {
            if (e.key >= "0" && e.key <= "9")
                this.appendDigit(e.key);
            else if (e.key === ".")
                this.appendDot();
            else if (e.key === "+" || e.key === "-" || e.key === "*" || e.key === "/")
                this.setOperator(e.key);
            else if (e.key === "Enter" || e.key === "=")
                this.calculate();
            else if (e.key === "Escape")
                this.clear();
            else if (e.key === "Backspace")
                this.backspace();
            else if (e.key === "%")
                this.percent();
        });
    }
}
var calculator = new Calculator(); // eslint-disable-line no-var
