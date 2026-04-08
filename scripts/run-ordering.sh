#!/bin/bash
# Wrapper to run order-questions.mts fully detached
# Usage: bash scripts/run-ordering.sh [--dimension periodo|categoria|subcategoria|all]
export PATH="/opt/homebrew/bin:$PATH"
cd /Volumes/MyApps/rag_master
LOG=/tmp/order-questions-$(date +%Y%m%d-%H%M%S).log
echo "Log: $LOG"
echo "Starting ordering script..."
npx tsx scripts/order-questions.mts "$@" > "$LOG" 2>&1 &
PID=$!
disown $PID
echo "PID: $PID"
echo "Monitor with: tail -f $LOG"
echo "Check DB progress with: node -e \"require('dotenv').config();const p=new(require('@prisma/client').PrismaClient)();p.question.count({where:{ordenPeriodo:{not:null}}}).then(c=>{console.log('Con orden:',c);p.\\\$disconnect()})\""
