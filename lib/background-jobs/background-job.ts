export class BackgroundJob {
  public name: string;
  public data: object;
  public process: (data: object) => Promise<void>;

  private constructor(
    name: string,
    data: object,
    process: (data: object) => Promise<void>
  ) {
    this.name = name;
    this.data = data;
    this.process = process;
  }

  public static create(
    name: string,
    data: object,
    process: (data: object) => Promise<void>
  ): BackgroundJob {
    return new BackgroundJob(name, data, process);
  }
}