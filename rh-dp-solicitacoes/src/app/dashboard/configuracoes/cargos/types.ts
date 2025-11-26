'use client';

export type CargoForm = {
  name: string;
  description: string;
  sectorProject: string;
  workplace: string;
  workSchedule: string;
  mainActivities: string;
  schooling: string;
  experience: string;
  requiredKnowledge: string;
  behavioralCompetencies: string;
  site: string;
  workPoint: string;
  departmentId: string | null;
};

export type Department = {
  id: string;
  label: string;
  description: string;
};