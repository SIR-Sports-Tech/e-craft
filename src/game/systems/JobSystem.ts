/** Seed of “pass tests for new jobs” — Head of Security cert. */

export type JobId = 'trainee' | 'security_chief' | 'builder_aide';

export interface JobState {
  current: JobId;
  securityScore: number;
  builderScore: number;
  unlocked: JobId[];
}

export class JobSystem {
  state: JobState = {
    current: 'trainee',
    securityScore: 0,
    builderScore: 0,
    unlocked: ['trainee'],
  };

  onMissionJailed(): void {
    this.state.securityScore += 50;
    this.tryUnlock();
  }

  onGarageBuilt(): void {
    this.state.builderScore += 30;
    this.tryUnlock();
  }

  private tryUnlock(): void {
    if (this.state.securityScore >= 50 && !this.state.unlocked.includes('security_chief')) {
      this.state.unlocked.push('security_chief');
      this.state.current = 'security_chief';
    }
    if (this.state.builderScore >= 30 && !this.state.unlocked.includes('builder_aide')) {
      this.state.unlocked.push('builder_aide');
    }
  }

  title(): string {
    switch (this.state.current) {
      case 'security_chief':
        return 'Head of Security';
      case 'builder_aide':
        return 'Builder Aide';
      default:
        return 'Security Trainee';
    }
  }

  boardLines(): string[] {
    return [
      `Job: ${this.title()}`,
      `Security XP: ${this.state.securityScore}`,
      `Builder XP: ${this.state.builderScore}`,
      this.state.unlocked.includes('security_chief')
        ? '✓ Head of Security unlocked'
        : 'Lock Sasquatch to unlock Head of Security',
      this.state.unlocked.includes('builder_aide')
        ? '✓ Builder Aide unlocked'
        : 'Finish Robot Garage with Jun for Builder Aide',
    ];
  }
}
